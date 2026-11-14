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

MODE_PROMPTS = {
    "standard": "Provide a balanced, clear, and comprehensive answer grounded strictly in the retrieved context.",
    "deep_research": "Perform an in-depth analytical synthesis across all retrieved context chunks. Structure your response with clear thematic sections, compare perspectives if present, and provide detailed technical or contextual insights.",
    "concise": "Provide a rapid, high signal-to-noise answer. Avoid filler. Use compact bullet points and direct conclusions.",
    "code_focused": "Emphasize implementation, code snippets, syntax, data structures, and concrete architectural patterns found in the context.",
    "student": "Explain clearly with approachable intuitive examples and structured breakdown suitable for a student or learner.",
    "interviewer": "Deliver concise, technical, interview-grade explanations emphasizing tradeoffs and architecture.",
}


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
        Yields Server-Sent Events (SSE) stream with live telemetry, semantic caching,
        and zero-overhead input/output guardrails.
        """
        total_start = time.perf_counter()
        active_mode = persona if persona in MODE_PROMPTS else "standard"

        # 1. Start event
        yield f"data: {json.dumps({'type': 'start', 'mode': active_mode})}\n\n"

        # 2. Input Guardrail Check (< 2ms regex)
        is_safe, sanitized_query, guardrail_status = check_input_guardrail(question)
        if not is_safe:
            total_latency = (time.perf_counter() - total_start) * 1000
            refusal = "I cannot fulfill this request because it violates input safety guidelines (prompt injection / jailbreak detected)."
            yield f"data: {json.dumps({'type': 'metadata', 'cache_hit': False, 'sources': [], 'guardrail_status': guardrail_status, 'confidence': 0.0})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': refusal})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'telemetry': {'ttft_ms': round(total_latency, 1), 'total_latency_ms': round(total_latency, 1), 'cache_hit': False, 'tokens_saved': 0, 'faithfulness_score': 0.0, 'confidence': 0.0, 'guardrail_status': guardrail_status, 'sources': []}})}\n\n"

            def _log_rejection():
                self.vector_store.log_query_telemetry(
                    query_text=question,
                    response_preview=refusal,
                    ttft_ms=total_latency,
                    total_latency_ms=total_latency,
                    cache_hit=False,
                    tokens_saved=0,
                    retrieval_confidence=0.0,
                    faithfulness_score=0.0,
                    guardrail_status=guardrail_status,
                    mode=active_mode,
                    collection_name=collection_name,
                )
            threading.Thread(target=_log_rejection, daemon=True).start()
            return

        # 3. Compute Query Embedding & Check Semantic Cache
        t_emb = time.perf_counter()
        q_vector = embed_query(sanitized_query)
        log_timing("query embedding for cache", time.perf_counter() - t_emb)

        cached = self.vector_store.check_semantic_cache(q_vector, mode=active_mode, threshold=0.90)
        if cached:
            ttft_ms = (time.perf_counter() - total_start) * 1000
            cached_answer = cached.get("response_text", "")
            cached_sources = cached.get("sources") or []
            tokens_saved = max(1, len(cached_answer) // 4)

            yield f"data: {json.dumps({'type': 'metadata', 'cache_hit': True, 'sources': cached_sources, 'confidence': 1.0, 'guardrail_status': guardrail_status})}\n\n"

            # Stream cached response smoothly with micro-chunks
            words = cached_answer.split(" ")
            for i, w in enumerate(words):
                chunk = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"
                time.sleep(0.012)

            total_latency = (time.perf_counter() - total_start) * 1000

            yield f"data: {json.dumps({'type': 'done', 'telemetry': {'ttft_ms': round(ttft_ms, 1), 'total_latency_ms': round(total_latency, 1), 'cache_hit': True, 'tokens_saved': tokens_saved, 'faithfulness_score': 1.0, 'confidence': 1.0, 'guardrail_status': guardrail_status, 'sources': cached_sources}})}\n\n"

            def _log_cache_hit():
                self.vector_store.log_query_telemetry(
                    query_text=sanitized_query,
                    response_preview=cached_answer,
                    ttft_ms=ttft_ms,
                    total_latency_ms=total_latency,
                    cache_hit=True,
                    tokens_saved=tokens_saved,
                    retrieval_confidence=1.0,
                    faithfulness_score=1.0,
                    guardrail_status=guardrail_status,
                    mode=active_mode,
                    collection_name=collection_name,
                )
            threading.Thread(target=_log_cache_hit, daemon=True).start()
            return

        # 4. Cache Miss -> Vector Retrieval
        history = clean_history(chat_history or [])
        retrieval_question = build_retrieval_question(sanitized_query, history)
        history_text = format_history(history)

        t_ret = time.perf_counter()
        retrieved = self.vector_store.query(collection_name, retrieval_question, top_k)
        log_timing("retrieval total", time.perf_counter() - t_ret)

        confidence = float(max((c.get("score") or 0.0 for c in retrieved), default=0.0))

        if not retrieved:
            total_latency = (time.perf_counter() - total_start) * 1000
            no_ctx_msg = "I could not find relevant context in this collection. Add sources to the collection or ask a more specific question."
            yield f"data: {json.dumps({'type': 'metadata', 'cache_hit': False, 'sources': [], 'guardrail_status': guardrail_status, 'confidence': 0.0})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': no_ctx_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'telemetry': {'ttft_ms': round(total_latency, 1), 'total_latency_ms': round(total_latency, 1), 'cache_hit': False, 'tokens_saved': 0, 'faithfulness_score': 0.0, 'confidence': 0.0, 'guardrail_status': guardrail_status, 'sources': []}})}\n\n"

            def _log_empty():
                self.vector_store.log_query_telemetry(
                    query_text=sanitized_query,
                    response_preview=no_ctx_msg,
                    ttft_ms=total_latency,
                    total_latency_ms=total_latency,
                    cache_hit=False,
                    tokens_saved=0,
                    retrieval_confidence=0.0,
                    faithfulness_score=0.0,
                    guardrail_status=guardrail_status,
                    mode=active_mode,
                    collection_name=collection_name,
                )
            threading.Thread(target=_log_empty, daemon=True).start()
            return

        # Format sources for metadata event
        formatted_sources = []
        context_blocks = []
        for i, item in enumerate(retrieved, start=1):
            meta = item.get("metadata", {}) or {}
            source = meta.get("source_name", "unknown")
            source_type = meta.get("source_type", "unknown")
            chunk_index = meta.get("chunk_index", -1)
            score = item.get("score")

            formatted_sources.append({
                "source_type": source_type,
                "source_name": source,
                "chunk_index": chunk_index,
                "text": item.get("text", ""),
                "score": score,
                "metadata": meta,
            })
            context_blocks.append(
                f"[Source {i}] type={source_type}; name={source}; chunk={chunk_index}; score={score}\n{item.get('text', '')}"
            )

        context = "\n\n".join(context_blocks)

        yield f"data: {json.dumps({'type': 'metadata', 'cache_hit': False, 'sources': formatted_sources, 'confidence': round(confidence, 2), 'guardrail_status': guardrail_status})}\n\n"

        # 5. Build Dynamic Prompt based on Mode
        mode_instruction = MODE_PROMPTS.get(active_mode, MODE_PROMPTS["standard"])
        system_prompt = (
            f"You are KnowledgeFlow, a precision multi-source RAG assistant. {mode_instruction} "
            "Use the retrieved context as the primary source of truth. "
            "Use conversation history to resolve follow-up questions and pronouns. "
            "Do not hallucinate facts outside the context. "
            "Do not invent facts or cite nonexistent documents."
        )

        user_prompt = f"""
Mode / Persona: {active_mode}

Conversation history:
{history_text}

Current question:
{sanitized_query}

Retrieved context:
{context}

Answer:
""".strip()

        # 6. Stream from Groq LLM
        max_tokens = 600 if active_mode == "deep_research" else 350
        ttft_ms = 0.0
        full_answer_parts = []

        try:
            stream = self.client.chat.completions.create(
                model=self.settings.groq_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=max_tokens,
                stream=True,
            )

            for chunk in stream:
                content = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
                if content:
                    if ttft_ms == 0.0:
                        ttft_ms = (time.perf_counter() - total_start) * 1000
                    full_answer_parts.append(content)
                    yield f"data: {json.dumps({'type': 'token', 'token': content})}\n\n"

        except Exception as exc:
            err_msg = f"\n[Generation error: {str(exc)}]"
            yield f"data: {json.dumps({'type': 'token', 'token': err_msg})}\n\n"
            full_answer_parts.append(err_msg)

        full_answer = "".join(full_answer_parts)
        total_latency = (time.perf_counter() - total_start) * 1000
        if ttft_ms == 0.0:
            ttft_ms = total_latency

        # 7. Zero-Overhead Output Evaluation (Faithfulness Score)
        faithfulness = compute_faithfulness_score(full_answer, retrieved)

        # 8. Done event with telemetry
        telemetry = {
            "ttft_ms": round(ttft_ms, 1),
            "total_latency_ms": round(total_latency, 1),
            "cache_hit": False,
            "tokens_saved": 0,
            "faithfulness_score": round(faithfulness, 2),
            "confidence": round(confidence, 2),
            "guardrail_status": guardrail_status,
            "sources": formatted_sources,
        }
        yield f"data: {json.dumps({'type': 'done', 'telemetry': telemetry})}\n\n"

        # 9. Asynchronously persist to semantic cache and query_logs
        def _persist_background():
            try:
                # Cache full answer if quality response was generated
                if full_answer and len(full_answer) > 20 and not full_answer.startswith("[Generation error"):
                    self.vector_store.store_semantic_cache(
                        query_text=sanitized_query,
                        q_vector=q_vector,
                        response_text=full_answer,
                        sources=formatted_sources,
                        mode=active_mode,
                    )
                self.vector_store.log_query_telemetry(
                    query_text=sanitized_query,
                    response_preview=full_answer,
                    ttft_ms=ttft_ms,
                    total_latency_ms=total_latency,
                    cache_hit=False,
                    tokens_saved=0,
                    retrieval_confidence=confidence,
                    faithfulness_score=faithfulness,
                    guardrail_status=guardrail_status,
                    mode=active_mode,
                    collection_name=collection_name,
                )
            except Exception as e:
                if self.settings.debug_timing:
                    print(f"[background persist error] {e}")

        threading.Thread(target=_persist_background, daemon=True).start()

    def answer(
        self,
        collection_name: str,
        question: str,
        top_k: int = 5,
        persona: str = "standard",
        chat_history: list[Any] | None = None,
    ) -> dict:
        """
        Synchronous fallback answer endpoint.
        """
        total_start = time.perf_counter()
        active_mode = persona if persona in MODE_PROMPTS else "standard"

        # Input guardrail
        is_safe, sanitized_query, guardrail_status = check_input_guardrail(question)
        if not is_safe:
            return {
                "answer": "I cannot fulfill this request because it violates input safety guidelines (prompt injection / jailbreak detected).",
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
        log_timing("retrieval total", time.perf_counter() - t0)

        if not retrieved:
            return {
                "answer": "I could not find relevant context in this collection. Add sources to the collection or ask a more specific question.",
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
                "source_type": source_type,
                "source_name": source,
                "chunk_index": chunk_index,
                "text": item.get("text", ""),
                "score": score,
                "metadata": meta,
            })
            context_blocks.append(
                f"[Source {i}] type={source_type}; name={source}; chunk={chunk_index}; score={score}\n{item['text']}"
            )

        context = "\n\n".join(context_blocks)
        mode_instruction = MODE_PROMPTS.get(active_mode, MODE_PROMPTS["standard"])

        system_prompt = (
            f"You are KnowledgeFlow, a precision multi-source RAG assistant. {mode_instruction} "
            "Use the retrieved context as the primary source of truth. "
            "Use conversation history to resolve follow-up questions and pronouns. "
            "Do not hallucinate facts outside the context."
        )

        user_prompt = f"""
Mode / Persona: {active_mode}

Conversation history:
{history_text}

Current question:
{sanitized_query}

Retrieved context:
{context}

Answer:
""".strip()

        t1 = time.perf_counter()
        completion = self.client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=600 if active_mode == "deep_research" else 350,
        )

        log_timing("groq llm", time.perf_counter() - t1)
        log_timing("query full total", time.perf_counter() - total_start)

        answer = completion.choices[0].message.content or ""

        # Background cache store
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
