import re
from typing import Tuple

# Fast compiled regex patterns for zero-overhead execution (<2ms)
JAILBREAK_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|an|in)?\s*(dan|developer|jailbreak|unrestricted|god)\s+mode", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*(extraction|reveal|display|leak|show)", re.IGNORECASE),
    re.compile(r"repeat\s+(the\s+)?(text|words|instructions)\s+above", re.IGNORECASE),
    re.compile(r"(disregard|forget)\s+all\s+(rules|guidelines|instructions)", re.IGNORECASE),
    re.compile(r"bypass\s+all\s+(safety|security|filters)", re.IGNORECASE),
]

EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_PATTERN = re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
API_KEY_PATTERN = re.compile(r"(sk-[a-zA-Z0-9]{20,}|gsk_[a-zA-Z0-9]{30,}|sb_secret_[a-zA-Z0-9_-]{20,})")
SSN_AADHAAR_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{4}\s\d{4}\s\d{4}\b")


def check_input_guardrail(query: str) -> Tuple[bool, str, str]:
    """
    Checks for prompt injection / jailbreak attempts and redacts sensitive PII.
    Returns: (is_safe, sanitized_query, guardrail_status)
    - guardrail_status: 'passed' | 'blocked_injection' | 'pii_redacted'
    """
    if not query:
        return True, query, "passed"

    # 1. Jailbreak & Prompt Injection check (< 1ms)
    for pattern in JAILBREAK_PATTERNS:
        if pattern.search(query):
            return False, query, "blocked_injection"

    # 2. PII Redaction
    sanitized = query
    pii_found = False

    if EMAIL_PATTERN.search(sanitized):
        sanitized = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", sanitized)
        pii_found = True

    if PHONE_PATTERN.search(sanitized):
        sanitized = PHONE_PATTERN.sub("[REDACTED_PHONE]", sanitized)
        pii_found = True

    if API_KEY_PATTERN.search(sanitized):
        sanitized = API_KEY_PATTERN.sub("[REDACTED_KEY]", sanitized)
        pii_found = True

    if SSN_AADHAAR_PATTERN.search(sanitized):
        sanitized = SSN_AADHAAR_PATTERN.sub("[REDACTED_ID]", sanitized)
        pii_found = True

    status = "pii_redacted" if pii_found else "passed"
    return True, sanitized, status


def compute_faithfulness_score(answer: str, retrieved_chunks: list[dict]) -> float:
    """
    Fast zero-dependency n-gram and token overlap score between generated answer
    and retrieved context chunks (0.0 to 1.0).
    Adds 0 LLM calls and consumes negligible CPU/RAM.
    """
    if not answer or not retrieved_chunks:
        return 0.0

    # Build context token set (unigrams + bigrams)
    context_tokens = set()
    for chunk in retrieved_chunks:
        text = chunk.get("text", "").lower()
        words = re.findall(r"\w+", text)
        for w in words:
            if len(w) > 2:
                context_tokens.add(w)
        for i in range(len(words) - 1):
            context_tokens.add(f"{words[i]}_{words[i+1]}")

    if not context_tokens:
        return 0.5

    # Extract answer tokens
    answer_words = re.findall(r"\w+", answer.lower())
    if not answer_words:
        return 0.0

    eval_tokens = [w for w in answer_words if len(w) > 2]
    eval_bigrams = [f"{answer_words[i]}_{answer_words[i+1]}" for i in range(len(answer_words) - 1)]

    total_tokens = len(eval_tokens) + len(eval_bigrams)
    if total_tokens == 0:
        return 0.5

    matched = sum(1 for t in eval_tokens if t in context_tokens)
    matched += sum(1 for b in eval_bigrams if b in context_tokens)

    # Normalized bounded score between 0.0 and 1.0 with baseline boost for grounded phrasing
    raw_score = matched / total_tokens
    # Scale: typical good RAG outputs have 40-70% content overlap with source chunks
    normalized_score = min(1.0, round(raw_score * 1.5, 2))
    return max(0.1, normalized_score)
