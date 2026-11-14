import hashlib
import re
import time
from functools import lru_cache
from typing import Any

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.config import get_settings
from app.services.embeddings import embed_query, embed_texts


def log_timing(label: str, seconds: float) -> None:
    if get_settings().debug_timing:
        print(f"[timing] {label}: {seconds:.3f}s")


def normalize_collection_name(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_-]+", "-", name)
    name = name.strip("-_")

    if len(name) < 3:
        name = f"kb-{name or 'default'}"

    return name[:63]


def vector_to_pg(values: list[float]) -> str:
    return "[" + ",".join(str(float(v)) for v in values) + "]"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class VectorStore:
    def __init__(self) -> None:
        self.init_pool()

    def init_pool(self) -> None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is missing.")

        self.pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
            timeout=15.0,
            max_idle=60.0,
            max_lifetime=300.0,
            check=ConnectionPool.check_connection,
            kwargs={
                "row_factory": dict_row,
                "prepare_threshold": None,
            },
            open=True,
        )
        try:
            self.pool.wait(timeout=10.0)
        except Exception:
            pass

    def get_conn(self):
        if getattr(self, "pool", None) is None or self.pool.closed:
            self.init_pool()
        return self.pool.connection()

    def heartbeat(self) -> bool:
        for attempt in range(2):
            try:
                with self.get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("select 1 as ok")
                        return cur.fetchone()["ok"] == 1
            except Exception:
                if attempt == 1:
                    raise
                time.sleep(0.5)
        return False

    def add_chunks(self, collection_name: str, chunks: list[str], metadatas: list[dict[str, Any]]) -> int:
        if not chunks:
            return 0

        collection = normalize_collection_name(collection_name)
        first_meta = metadatas[0] if metadatas else {}

        source_type = str(first_meta.get("source_type", "unknown"))
        source_name = str(first_meta.get("source_name", "unknown"))
        source_url = first_meta.get("source_url")

        joined_text = "\n\n".join(chunks)
        content_hash = text_hash(joined_text)

        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into rag_documents
                      (collection_name, source_type, source_name, source_url, content_hash, metadata)
                    values
                      (%s, %s, %s, %s, %s, %s)
                    on conflict (collection_name, source_type, source_name, content_hash)
                    do nothing
                    returning id
                    """,
                    (
                        collection,
                        source_type,
                        source_name,
                        source_url,
                        content_hash,
                        Jsonb({"chunks": len(chunks), "characters": len(joined_text)}),
                    ),
                )

                inserted_doc = cur.fetchone()

                if not inserted_doc:
                    return 0

                document_id = inserted_doc["id"]

                t0 = time.perf_counter()
                vectors = embed_texts(chunks)
                log_timing(f"embed {len(chunks)} chunks", time.perf_counter() - t0)

                rows = []

                for i, (chunk, vector, meta) in enumerate(zip(chunks, vectors, metadatas)):
                    chunk_index = int(meta.get("chunk_index", i))
                    chunk_metadata = dict(meta)
                    chunk_metadata["collection_name"] = collection

                    rows.append(
                        (
                            document_id,
                            collection,
                            str(meta.get("source_type", source_type)),
                            str(meta.get("source_name", source_name)),
                            chunk_index,
                            chunk,
                            len(chunk),
                            Jsonb(chunk_metadata),
                            vector_to_pg(vector),
                        )
                    )

                t1 = time.perf_counter()

                cur.executemany(
                    """
                    insert into rag_chunks
                      (document_id, collection_name, source_type, source_name, chunk_index, content, char_count, metadata, embedding)
                    values
                      (%s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector)
                    """,
                    rows,
                )

                log_timing("postgres insert", time.perf_counter() - t1)

        return len(chunks)

    def query(self, collection_name: str, question: str, top_k: int = 5) -> list[dict[str, Any]]:
        collection = normalize_collection_name(collection_name)

        t0 = time.perf_counter()
        q_vector = embed_query(question)
        log_timing("query embedding", time.perf_counter() - t0)

        with self.get_conn() as conn:
            with conn.cursor() as cur:
                t1 = time.perf_counter()

                try:
                    cur.execute(
                        """
                        select
                          id,
                          document_id,
                          collection_name,
                          source_type,
                          source_name,
                          chunk_index,
                          content,
                          metadata,
                          similarity
                        from match_rag_chunks(%s::extensions.vector, %s, %s)
                        """,
                        (vector_to_pg(q_vector), top_k, collection),
                    )
                    rows = cur.fetchall()
                except Exception:
                    conn.rollback()
                    pg_vec = vector_to_pg(q_vector)
                    cur.execute(
                        """
                        select
                          id,
                          document_id,
                          collection_name,
                          source_type,
                          source_name,
                          chunk_index,
                          content,
                          metadata,
                          1 - (embedding <=> %s::extensions.vector) as similarity
                        from rag_chunks
                        where collection_name = %s
                        order by embedding <=> %s::extensions.vector
                        limit %s
                        """,
                        (pg_vec, collection, pg_vec, top_k),
                    )
                    rows = cur.fetchall()
                log_timing("postgres vector search", time.perf_counter() - t1)

        items: list[dict[str, Any]] = []

        for row in rows:
            metadata = dict(row.get("metadata") or {})
            metadata.setdefault("source_type", row["source_type"])
            metadata.setdefault("source_name", row["source_name"])
            metadata.setdefault("chunk_index", row["chunk_index"])
            metadata.setdefault("collection_name", row["collection_name"])
            metadata.setdefault("document_id", str(row["document_id"]))
            metadata.setdefault("chunk_id", str(row["id"]))

            items.append(
                {
                    "text": row["content"],
                    "metadata": metadata,
                    "score": None if row["similarity"] is None else round(float(row["similarity"]), 4),
                }
            )

        return items

    def list_collections(self) -> list[str]:
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("select distinct collection_name from rag_documents order by collection_name")
                return [row["collection_name"] for row in cur.fetchall()]

    def delete_collection(self, name: str) -> None:
        collection = normalize_collection_name(name)

        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("delete from rag_documents where collection_name = %s", (collection,))

    def collection_stats(self, name: str) -> dict[str, Any]:
        collection = normalize_collection_name(name)

        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                      count(distinct d.id) as documents,
                      count(c.id) as chunks,
                      coalesce(sum(c.char_count), 0) as characters
                    from rag_documents d
                    left join rag_chunks c on c.document_id = d.id
                    where d.collection_name = %s
                    """,
                    (collection,),
                )

                row = cur.fetchone()

        return {
            "collection_name": collection,
            "documents": int(row["documents"] or 0),
            "chunks": int(row["chunks"] or 0),
            "characters": int(row["characters"] or 0),
        }

    def list_sources(self, name: str) -> list[dict[str, Any]]:
        collection = normalize_collection_name(name)
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                      d.id,
                      d.source_name,
                      d.source_type,
                      d.source_url,
                      d.created_at,
                      count(c.id) as chunks,
                      coalesce(sum(c.char_count), 0) as characters
                    from rag_documents d
                    left join rag_chunks c on c.document_id = d.id
                    where d.collection_name = %s
                    group by d.id, d.source_name, d.source_type, d.source_url, d.created_at
                    order by d.created_at desc
                    """,
                    (collection,),
                )
                rows = cur.fetchall()
        return [
            {
                "id": str(r["id"]),
                "source_name": r["source_name"],
                "source_type": r["source_type"],
                "source_url": r["source_url"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "chunks": int(r["chunks"] or 0),
                "characters": int(r["characters"] or 0),
            }
            for r in rows
        ]

    def get_source_chunks(self, name: str, source_name: str) -> list[dict[str, Any]]:
        collection = normalize_collection_name(name)
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select id, chunk_index, content, char_count, metadata, created_at
                    from rag_chunks
                    where collection_name = %s and source_name = %s
                    order by chunk_index asc
                    """,
                    (collection, source_name),
                )
                rows = cur.fetchall()
        return [
            {
                "id": str(r["id"]),
                "chunk_index": r["chunk_index"],
                "content": r["content"],
                "char_count": r["char_count"],
                "metadata": dict(r["metadata"] or {}),
            }
            for r in rows
        ]

    def get_analytics(self) -> dict[str, Any]:
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                      count(distinct collection_name) as collections,
                      count(distinct id) as documents
                    from rag_documents
                    """
                )
                doc_stats = cur.fetchone()

                cur.execute(
                    """
                    select
                      count(id) as chunks,
                      coalesce(sum(char_count), 0) as characters
                    from rag_chunks
                    """
                )
                chunk_stats = cur.fetchone()

                cur.execute(
                    """
                    select source_type, count(id) as count
                    from rag_documents
                    group by source_type
                    order by count desc
                    """
                )
                type_breakdown = {r["source_type"]: int(r["count"]) for r in cur.fetchall()}

        return {
            "collections": int(doc_stats["collections"] or 0),
            "documents": int(doc_stats["documents"] or 0),
            "chunks": int(chunk_stats["chunks"] or 0),
            "characters": int(chunk_stats["characters"] or 0),
            "source_distribution": type_breakdown,
        }

    def delete_source(self, name: str, source_name: str) -> bool:
        collection = normalize_collection_name(name)
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "delete from rag_documents where collection_name = %s and source_name = %s",
                    (collection, source_name),
                )
        return True

    def check_semantic_cache(self, q_vector: list[float], mode: str, threshold: float = 0.92) -> dict[str, Any] | None:
        """
        Check semantic cache for query similarity >= threshold with matching persona/mode.
        Returns cached response or None.
        """
        pg_vec = vector_to_pg(q_vector)
        try:
            with self.get_conn() as conn:
                with conn.cursor() as cur:
                    # Try stored procedure first
                    try:
                        cur.execute(
                            "SELECT id, query_text, response_text, sources, similarity FROM match_semantic_cache(%s::extensions.vector, %s, %s);",
                            (pg_vec, mode, threshold),
                        )
                        row = cur.fetchone()
                    except Exception:
                        conn.rollback()
                        cur.execute(
                            """
                            SELECT id, query_text, response_text, sources, (1 - (query_embedding <=> %s::extensions.vector)) AS similarity
                            FROM semantic_cache
                            WHERE mode = %s AND (1 - (query_embedding <=> %s::extensions.vector)) >= %s
                            ORDER BY query_embedding <=> %s::extensions.vector
                            LIMIT 1;
                            """,
                            (pg_vec, mode, pg_vec, threshold, pg_vec),
                        )
                        row = cur.fetchone()

                    if row:
                        cache_id = row["id"]
                        cur.execute(
                            "UPDATE semantic_cache SET hit_count = hit_count + 1, last_accessed = NOW() WHERE id = %s;",
                            (cache_id,),
                        )
                        return {
                            "id": str(row["id"]),
                            "query_text": row["query_text"],
                            "response_text": row["response_text"],
                            "sources": row.get("sources") or [],
                            "similarity": float(row["similarity"]),
                        }
        except Exception as e:
            if get_settings().debug_timing:
                print(f"[semantic_cache error] {e}")
        return None

    def store_semantic_cache(self, query_text: str, q_vector: list[float], response_text: str, sources: list[dict], mode: str) -> None:
        """
        Store answered query into semantic cache. Invoked via BackgroundTasks.
        """
        pg_vec = vector_to_pg(q_vector)
        try:
            with self.get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO semantic_cache (query_text, query_embedding, response_text, sources, mode)
                        VALUES (%s, %s::extensions.vector, %s, %s, %s);
                        """,
                        (query_text, pg_vec, response_text, Jsonb(sources), mode),
                    )
        except Exception as e:
            if get_settings().debug_timing:
                print(f"[store_semantic_cache error] {e}")

    def log_query_telemetry(
        self,
        query_text: str,
        response_preview: str,
        ttft_ms: float,
        total_latency_ms: float,
        cache_hit: bool,
        tokens_saved: int,
        retrieval_confidence: float,
        faithfulness_score: float,
        guardrail_status: str,
        mode: str,
        collection_name: str,
    ) -> None:
        """
        Log live telemetry per query into query_logs table. Invoked in BackgroundTasks (0ms latency impact).
        """
        try:
            with self.get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO query_logs (
                            query_text, response_preview, ttft_ms, total_latency_ms,
                            cache_hit, tokens_saved, retrieval_confidence, faithfulness_score,
                            guardrail_status, mode, collection_name
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            query_text[:500] if query_text else "",
                            response_preview[:300] if response_preview else "",
                            round(ttft_ms, 2),
                            round(total_latency_ms, 2),
                            cache_hit,
                            tokens_saved,
                            round(retrieval_confidence, 4),
                            round(faithfulness_score, 4),
                            guardrail_status,
                            mode,
                            collection_name,
                        ),
                    )
        except Exception as e:
            if get_settings().debug_timing:
                print(f"[log_query_telemetry error] {e}")

    def get_realtime_analytics(self) -> dict[str, Any]:
        """
        Aggregated live KPIs from query_logs for the frontend telemetry drawer.
        """
        default_stats = {
            "total_queries": 0,
            "avg_ttft_ms": 0.0,
            "avg_latency_ms": 0.0,
            "cache_hit_rate_pct": 0.0,
            "total_tokens_saved": 0,
            "avg_faithfulness_score": 0.0,
            "avg_retrieval_confidence": 0.0,
            "guardrails_triggered": 0,
            "guardrail_breakdown": {},
            "time_series": [],
            "recent_queries": [],
        }
        try:
            with self.get_conn() as conn:
                with conn.cursor() as cur:
                    # 1. High-level aggregates
                    cur.execute(
                        """
                        SELECT
                            COUNT(*) AS total_queries,
                            COALESCE(AVG(ttft_ms), 0) AS avg_ttft_ms,
                            COALESCE(AVG(total_latency_ms), 0) AS avg_latency_ms,
                            COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) AS cache_hit_rate,
                            COALESCE(SUM(tokens_saved), 0) AS total_tokens_saved,
                            COALESCE(AVG(faithfulness_score), 0) AS avg_faithfulness,
                            COALESCE(AVG(retrieval_confidence), 0) AS avg_confidence,
                            COALESCE(SUM(CASE WHEN guardrail_status != 'passed' THEN 1 ELSE 0 END), 0) AS guardrails_triggered
                        FROM query_logs;
                        """
                    )
                    agg = cur.fetchone()

                    # 2. Guardrail status breakdown
                    cur.execute(
                        """
                        SELECT guardrail_status, COUNT(*) as count
                        FROM query_logs
                        GROUP BY guardrail_status;
                        """
                    )
                    guardrail_breakdown = {r["guardrail_status"]: int(r["count"]) for r in cur.fetchall()}

                    # 3. 7-day query activity time-series
                    cur.execute(
                        """
                        SELECT TO_CHAR(created_at, 'Dy') AS day_name, DATE(created_at) AS q_date, COUNT(*) AS count
                        FROM query_logs
                        WHERE created_at >= NOW() - INTERVAL '7 days'
                        GROUP BY DATE(created_at), TO_CHAR(created_at, 'Dy')
                        ORDER BY DATE(created_at) ASC;
                        """
                    )
                    ts_rows = cur.fetchall()
                    time_series = [{"day": r["day_name"], "date": str(r["q_date"]), "count": int(r["count"])} for r in ts_rows]

                    # 4. Recent queries telemetry
                    cur.execute(
                        """
                        SELECT id, query_text, ttft_ms, total_latency_ms, cache_hit, tokens_saved,
                               retrieval_confidence, faithfulness_score, guardrail_status, mode, created_at
                        FROM query_logs
                        ORDER BY created_at DESC
                        LIMIT 8;
                        """
                    )
                    recent_rows = cur.fetchall()
                    recent_queries = [
                        {
                            "id": str(r["id"]),
                            "query": r["query_text"],
                            "ttft_ms": round(float(r["ttft_ms"]), 1),
                            "total_latency_ms": round(float(r["total_latency_ms"]), 1),
                            "cache_hit": bool(r["cache_hit"]),
                            "tokens_saved": int(r["tokens_saved"]),
                            "faithfulness": round(float(r["faithfulness_score"]), 2),
                            "confidence": round(float(r["retrieval_confidence"]), 2),
                            "guardrail": r["guardrail_status"],
                            "mode": r["mode"],
                            "time": r["created_at"].strftime("%H:%M:%S") if r["created_at"] else "",
                        }
                        for r in recent_rows
                    ]

                    return {
                        "total_queries": int(agg["total_queries"] or 0),
                        "avg_ttft_ms": round(float(agg["avg_ttft_ms"] or 0), 1),
                        "avg_latency_ms": round(float(agg["avg_latency_ms"] or 0), 1),
                        "cache_hit_rate_pct": round(float(agg["cache_hit_rate"] or 0), 1),
                        "total_tokens_saved": int(agg["total_tokens_saved"] or 0),
                        "avg_faithfulness_score": round(float(agg["avg_faithfulness"] or 0), 2),
                        "avg_retrieval_confidence": round(float(agg["avg_confidence"] or 0), 2),
                        "guardrails_triggered": int(agg["guardrails_triggered"] or 0),
                        "guardrail_breakdown": guardrail_breakdown,
                        "time_series": time_series,
                        "recent_queries": recent_queries,
                    }
        except Exception as e:
            if get_settings().debug_timing:
                print(f"[get_realtime_analytics error] {e}")
            return default_stats


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return VectorStore()