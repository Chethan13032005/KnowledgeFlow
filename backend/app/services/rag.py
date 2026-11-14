import json
import threading
import time
from functools import lru_cache
from typing import Any, Generator

from groq import Groq

from app.config import get_settings
from app.services.embeddings import embed_query
from app.services.guardrails import check_input_guardrail, compute_faithfulness_score
from app.services.vector_store import get_vector_store

# Minimum retrieval confidence to attempt an answer — below this, refuse
MIN_CONFIDENCE_THRESHOLD = 0.40

MODE_PROMPTS = {
    "standard": "Provide a balanced, clear answer grounded strictly in the retrieved context.",
    "deep_research": "Perform an analytical synthesis across all retrieved context. Structure with clear sections and compare perspectives present in the sources.",
    "concise": "Provide a rapid, high signal-to-noise answer. Avoid filler. Use compact bullet points and direct conclusions only.",
    "code_focused": "Emphasize implementation, code snippets, syntax, data structures, and architectural patterns found in the context.",
    "student": "Explain clearly with approachable examples and structured breakdown suitable for a student.",
    "interviewer": "Deliver concise, technical, interview-grade explanations emphasizing tradeoffs and architecture.",
}

# Strict system prompt that prevents hallucination
STRICT_SYSTEM_PROMPT = (
    "You are KnowledgeFlow, a strictly grounded RAG assistant. "
    "CRITICAL RULES — you MUST follow ALL of these:\n"
    "1. ONLY use information that is EXPLICITLY present in the 'Retrieved context' below.\n"
    "2. If the retrieved context does NOT contain information to answer the question, say EXACTLY: "
    "'The uploaded sources do not contain information about this topic. Please ingest relevant documents first.'\n"
    "3. NEVER generate information from your general knowledge. NEVER say 'I can provide a general overview' or similar.\n"
    "4. NEVER fabricate, infer, or extend beyond what the sources explicitly state.\n"
    "5. Keep your answer concise and complete within 250 words. Do not start long explanations that would get cut off.\n"
    "6. Use conversation history ONLY to resolve pronouns (it, this, that) — NOT as a source of facts.\n"
    "7. Start with the direct answer. Use bullet points when helpful.\n"
)


def log_timing(label: str, seconds: float) -> None:
    if get_settings().debug_timing:
        print(f"[timing] {label}: {seconds:.3f}s")


def clean_history(chat_history: list[Any], max_messages: int = 6) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []

    for item in chat_history[-max_messages:]:
        role = item.role if hasattr(item, "role") else item.get("role", "")
        content = item.content if hasattr(item, "content") else item.get("content", "")

        role = str(role).lower().strip()
        content = str(content).strip()

        if role not in {"user", "assistant"}:
            continue

        if content:
            cleaned.append({"role": role, "content": content[:1200]})

    return cleaned


def format_history(chat_history: list[dict[str, str]]) -> str:
    if not chat_history:
        return "No previous conversation."

    lines = []

    for item in chat_history:
        role = "User" if item["role"] == "user" else "Assistant"
        lines.append(f"{role}: {item['content']}")

    return "\n".join(lines)


def build_retrieval_question(question: str, chat_history: list[dict[str, str]]) -> str:
    recent_user_turns = [item["content"] for item in chat_history if item["role"] == "user"][-3:]

    if not recent_user_turns:
        return question

    return "\n".join(recent_user_turns + [question])


def _build_refusal_msg(confidence: float) -> str:
    return (
        "The uploaded sources do not contain relevant information about this topic. "
        f"(Retrieval confidence: {round(confidence * 100)}%) "
        "Please ingest documents related to your question first, then ask again."
    )


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


class RAGService:
    def __init__(self) -> None:
        import httpx
        self.settings = get_settings()
        self.vector_store = get_vector_store()
        api_key = (self.settings.groq_api_key or "").strip().strip("'\"")

        try:
            # Force IPv4 transport to prevent Render IPv6 route timeout
            transport = httpx.HTTPTransport(local_address="0.0.0.0")
            http_client = httpx.Client(transport=transport, timeout=45.0)
            self.client = Groq(api_key=api_key, http_client=http_client)
        except Exception:
            self.client = Groq(api_key=api_key, timeout=45.0)

    def _log_bg(self, **kwargs):
        """Fire-and-forget telemetry logging in background thread."""
        def _inner():
            try:
                self.vector_store.log_query_telemetry(**kwargs)
            except Exception as e:
                if self.settings.debug_timing:
                    print(f"[bg telemetry error] {e}")
        threading.Thread(target=_inner, daemon=True).start()

    def answer_stream(
        self,
        collection_name: str,
        question: str,
        top_k: int = 5,
        persona: str = "standard",
        chat_history: list[Any] | None = None,
        background_tasks: Any = None,
    ) -> Generator[str, None, None]:
        """
        SSE stream with semantic caching, guardrails, confidence gating & telemetry.
        """
        total_start = time.perf_counter()
        active_mode = persona if persona in MODE_PROMPTS else "standard"

        # 1. Start event
        yield _sse("start", {"mode": active_mode})

        # 2. Input Guardrail (< 2ms regex)
        is_safe, sanitized_query, guardrail_status = check_input_guardrail(question)
        if not is_safe:
            lat = (time.perf_counter() - total_start) * 1000
            refusal = "⚠️ This request was blocked by the input guardrail (prompt injection detected)."
            yield _sse("metadata", {"cache_hit": False, "sources": [], "guardrail_status": guardrail_status, "confidence": 0.0})
            yield _sse("token", {"token": refusal})
            yield _sse("done", {"telemetry": {"ttft_ms": round(lat, 1), "total_latency_ms": round(lat, 1), "cache_hit": False, "tokens_saved": 0, "faithfulness_score": 0.0, "confidence": 0.0, "guardrail_status": guardrail_status, "sources": []}})
            self._log_bg(query_text=question, response_preview=refusal, ttft_ms=lat, total_latency_ms=lat, cache_hit=False, tokens_saved=0, retrieval_confidence=0.0, faithfulness_score=0.0, guardrail_status=guardrail_status, mode=active_mode, collection_name=collection_name)
            return

        # 3. Compute embedding & check semantic cache
        t_emb = time.perf_counter()
        q_vector = embed_query(sanitized_query)
        log_timing("query embedding", time.perf_counter() - t_emb)

        cached = self.vector_store.check_semantic_cache(q_vector, mode=active_mode, threshold=0.90)
        if cached:
            ttft_ms = (time.perf_counter() - total_start) * 1000
            cached_answer = cached.get("response_text", "")
            cached_sources = cached.get("sources") or []
            tokens_saved = max(1, len(cached_answer) // 4)

            yield _sse("metadata", {"cache_hit": True, "sources": cached_sources, "confidence": 1.0, "guardrail_status": guardrail_status})

            # Stream cached words smoothly
            words = cached_answer.split(" ")
            for i, w in enumerate(words):
                yield _sse("token", {"token": w + (" " if i < len(words) - 1 else "")})
                time.sleep(0.008)

            total_latency = (time.perf_counter() - total_start) * 1000
            yield _sse("done", {"telemetry": {"ttft_ms": round(ttft_ms, 1), "total_latency_ms": round(total_latency, 1), "cache_hit": True, "tokens_saved": tokens_saved, "faithfulness_score": 1.0, "confidence": 1.0, "guardrail_status": guardrail_status, "sources": cached_sources}})
            self._log_bg(query_text=sanitized_query, response_preview=cached_answer, ttft_ms=ttft_ms, total_latency_ms=total_latency, cache_hit=True, tokens_saved=tokens_saved, retrieval_confidence=1.0, faithfulness_score=1.0, guardrail_status=guardrail_status, mode=active_mode, collection_name=collection_name)
            return

        # 4. Cache miss -> vector retrieval
        history = clean_history(chat_history or [])
        retrieval_question = build_retrieval_question(sanitized_query, history)
        history_text = format_history(history)

        t_ret = time.perf_counter()
        retrieved = self.vector_store.query(collection_name, retrieval_question, top_k)
        log_timing("retrieval", time.perf_counter() - t_ret)

        confidence = float(max((c.get("score") or 0.0 for c in retrieved), default=0.0)) if retrieved else 0.0

        # 5. CONFIDENCE GATE — refuse if retrieval is too weak
        if not retrieved or confidence < MIN_CONFIDENCE_THRESHOLD:
            lat = (time.perf_counter() - total_start) * 1000
            refusal = _build_refusal_msg(confidence)
            yield _sse("metadata", {"cache_hit": False, "sources": [], "guardrail_status": "low_confidence_refusal", "confidence": round(confidence, 2)})
            yield _sse("token", {"token": refusal})
            yield _sse("done", {"telemetry": {"ttft_ms": round(lat, 1), "total_latency_ms": round(lat, 1), "cache_hit": False, "tokens_saved": 0, "faithfulness_score": 0.0, "confidence": round(confidence, 2), "guardrail_status": "low_confidence_refusal", "sources": []}})
            self._log_bg(query_text=sanitized_query, response_preview=refusal, ttft_ms=lat, total_latency_ms=lat, cache_hit=False, tokens_saved=0, retrieval_confidence=confidence, faithfulness_score=0.0, guardrail_status="low_confidence_refusal", mode=active_mode, collection_name=collection_name)
            return

        # 6. Format sources & context
        formatted_sources = []
        context_blocks = []
        for i, item in enumerate(retrieved, start=1):
            meta = item.get("metadata", {}) or {}
            source = meta.get("source_name", "unknown")
            source_type = meta.get("source_type", "unknown")
            chunk_index = meta.get("chunk_index", -1)
            score = item.get("score")

            formatted_sources.append({
                "source_type": source_type, "source_name": source,
                "chunk_index": chunk_index, "text": item.get("text", ""),
                "score": score, "metadata": meta,
            })
            context_blocks.append(
                f"[Source {i}] type={source_type}; name={source}; chunk={chunk_index}; score={score}\n{item.get('text', '')}"
            )

        context = "\n\n".join(context_blocks)

        yield _sse("metadata", {"cache_hit": False, "sources": formatted_sources, "confidence": round(confidence, 2), "guardrail_status": guardrail_status})

        # 7. Build prompt
        mode_instruction = MODE_PROMPTS.get(active_mode, MODE_PROMPTS["standard"])

        user_prompt = f"""Mode: {active_mode}
{mode_instruction}

Conversation history:
{history_text}

Current question:
{sanitized_query}

Retrieved context:
{context}

Answer (ONLY from the retrieved context above, max 250 words):"""

        # 8. Stream from Groq
        max_tokens = 400 if active_mode == "deep_research" else 280
        ttft_ms = 0.0
        full_answer_parts = []

        try:
            stream = self.client.chat.completions.create(
                model=self.settings.groq_model,
                messages=[
                    {"role": "system", "content": STRICT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.15,
                max_tokens=max_tokens,
                stream=True,
            )

            for chunk in stream:
                content = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
                if content:
                    if ttft_ms == 0.0:
                        ttft_ms = (time.perf_counter() - total_start) * 1000
                    full_answer_parts.append(content)
                    yield _sse("token", {"token": content})

        except Exception as exc:
            err_msg = f"\n[Generation error: {str(exc)}]"
            yield _sse("token", {"token": err_msg})
            full_answer_parts.append(err_msg)

        full_answer = "".join(full_answer_parts)
        total_latency = (time.perf_counter() - total_start) * 1000
        if ttft_ms == 0.0:
            ttft_ms = total_latency

        # 9. Faithfulness score
        faithfulness = compute_faithfulness_score(full_answer, retrieved)

        # 10. Done event
        telemetry = {
            "ttft_ms": round(ttft_ms, 1), "total_latency_ms": round(total_latency, 1),
            "cache_hit": False, "tokens_saved": 0,
            "faithfulness_score": round(faithfulness, 2), "confidence": round(confidence, 2),
            "guardrail_status": guardrail_status, "sources": formatted_sources,
        }
        yield _sse("done", {"telemetry": telemetry})

        # 11. Background persist (cache + telemetry)
        def _persist():
            try:
                if full_answer and len(full_answer) > 30 and not full_answer.startswith("[Generation error") and confidence >= 0.50:
                    self.vector_store.store_semantic_cache(
                        query_text=sanitized_query, q_vector=q_vector,
                        response_text=full_answer, sources=formatted_sources, mode=active_mode,
                    )
                self.vector_store.log_query_telemetry(
                    query_text=sanitized_query, response_preview=full_answer,
                    ttft_ms=ttft_ms, total_latency_ms=total_latency,
                    cache_hit=False, tokens_saved=0,
                    retrieval_confidence=confidence, faithfulness_score=faithfulness,
                    guardrail_status=guardrail_status, mode=active_mode, collection_name=collection_name,
                )
            except Exception as e:
                if self.settings.debug_timing:
                    print(f"[bg persist error] {e}")
        threading.Thread(target=_persist, daemon=True).start()

    def answer(
        self,
        collection_name: str,
        question: str,
        top_k: int = 5,
        persona: str = "standard",
        chat_history: list[Any] | None = None,
    ) -> dict:
        """Synchronous fallback answer endpoint."""
        total_start = time.perf_counter()
        active_mode = persona if persona in MODE_PROMPTS else "standard"

        # Input guardrail
        is_safe, sanitized_query, guardrail_status = check_input_guardrail(question)
        if not is_safe:
            return {
                "answer": "⚠️ This request was blocked by the input guardrail (prompt injection detected).",
                "sources": [],
            }

        # Check cache
        q_vector = embed_query(sanitized_query)
        cached = self.vector_store.check_semantic_cache(q_vector, mode=active_mode, threshold=0.90)
        if cached:
            return {
                "answer": cached["response_text"],
                "sources": cached.get("sources") or [],
            }

        history = clean_history(chat_history or [])
        retrieval_question = build_retrieval_question(sanitized_query, history)
        history_text = format_history(history)

        t0 = time.perf_counter()
        retrieved = self.vector_store.query(collection_name, retrieval_question, top_k)
        log_timing("retrieval", time.perf_counter() - t0)

        confidence = float(max((c.get("score") or 0.0 for c in retrieved), default=0.0)) if retrieved else 0.0

        # Confidence gate
        if not retrieved or confidence < MIN_CONFIDENCE_THRESHOLD:
            return {
                "answer": _build_refusal_msg(confidence),
                "sources": [],
            }

        context_blocks = []
        formatted_sources = []
        for i, item in enumerate(retrieved, start=1):
            meta = item["metadata"]
            source = meta.get("source_name", "unknown")
            source_type = meta.get("source_type", "unknown")
            chunk_index = meta.get("chunk_index", -1)
            score = item.get("score")

            formatted_sources.append({
                "source_type": source_type, "source_name": source,
                "chunk_index": chunk_index, "text": item.get("text", ""),
                "score": score, "metadata": meta,
            })
            context_blocks.append(
                f"[Source {i}] type={source_type}; name={source}; chunk={chunk_index}; score={score}\n{item['text']}"
            )

        context = "\n\n".join(context_blocks)
        mode_instruction = MODE_PROMPTS.get(active_mode, MODE_PROMPTS["standard"])

        user_prompt = f"""Mode: {active_mode}
{mode_instruction}

Conversation history:
{history_text}

Current question:
{sanitized_query}

Retrieved context:
{context}

Answer (ONLY from the retrieved context above, max 250 words):"""

        t1 = time.perf_counter()
        completion = self.client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {"role": "system", "content": STRICT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.15,
            max_tokens=400 if active_mode == "deep_research" else 280,
        )

        log_timing("groq llm", time.perf_counter() - t1)
        log_timing("total", time.perf_counter() - total_start)

        answer = completion.choices[0].message.content or ""

        # Only cache high-confidence answers
        if confidence >= 0.50 and len(answer) > 30:
            threading.Thread(
                target=self.vector_store.store_semantic_cache,
                args=(sanitized_query, q_vector, answer, formatted_sources, active_mode),
                daemon=True,
            ).start()

        return {
            "answer": answer,
            "sources": formatted_sources,
        }


@lru_cache(maxsize=1)
def get_rag_service() -> RAGService:
    return RAGService()
