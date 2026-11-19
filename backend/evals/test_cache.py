import os
import sys
import psycopg
from psycopg.rows import dict_row

# Force CPU
os.environ["CUDA_VISIBLE_DEVICES"] = ""
sys.path.insert(0, "C:/Users/Mr.Chethan/Downloads/multisource-rag-assistant-main/KnowledgeFlow/backend")

from app.config import get_settings
from app.services.embeddings import embed_query
from app.services.vector_store import vector_to_pg

url = get_settings().database_url
conn = psycopg.connect(url, prepare_threshold=None, row_factory=dict_row)

base_query = "what is sql"
base_vec = embed_query(base_query)

variations = [
    ("what is sql", "exact identical query"),
    ("what is sql ?", "trailing question mark and space"),
    ("What is SQL?", "capitalization and question mark"),
    ("explain sql", "synonym / instruction variation"),
    ("what is structured query language?", "expanded acronym"),
    ("tell me about sql", "conversational variation"),
    ("how does sql work", "functional question"),
    ("what is dynamic programming", "completely different topic"),
]

print(f"Base query: '{base_query}'")
with conn.cursor() as cur:
    for q, desc in variations:
        v = embed_query(q)
        cur.execute("SELECT 1 - (%s::extensions.vector <=> %s::extensions.vector) as similarity;", (vector_to_pg(base_vec), vector_to_pg(v)))
        sim = float(cur.fetchone()["similarity"])
        print(f"  vs '{q}' ({desc}): similarity = {sim:.4f}")

conn.close()
