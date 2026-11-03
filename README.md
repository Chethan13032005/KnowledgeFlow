# KnowledgeFlow – Multi-source RAG Assistant

> **Ingest • Retrieve • Understand • Generate**  
> *A production-grade, grounded AI assistant over your documents, web pages, and videos.*

KnowledgeFlow is an AI-powered RAG platform that processes PDFs, documents, text, websites, and YouTube transcripts. It uses semantic search, Sentence Transformers, PostgreSQL with pgvector, and Groq LLMs to deliver context-aware answers with source transparency, collections, and persona-based responses.

---

## ✨ Features

- **🌗 Light & Dark Themes** – Built-in persistent theme preference with zero flash on initial load.
- **📄 Multi-Source Ingestion**
  - **Documents**: PDF (`PyMuPDF`), DOCX (`python-docx`), PPTX (`python-pptx`), TXT, Markdown.
  - **Web**: Clean article extraction via BeautifulSoup4.
  - **Video**: Timestamped YouTube transcript extraction via `youtube-transcript-api`.
  - **Raw Text**: Instant paste notes with automatic normalization.
- **🎯 Source-Grounded Answers** – Every answer cites exact source names, chunk indices, and cosine similarity confidence scores.
- **🗂️ Collection Workspaces** – Isolated multi-tenant namespaces with individual source deletion and storage quotas.
- **👤 AI Personas** – Student, Developer, Interviewer, and Concise response styles.
- **📊 Analytics Dashboard** – Real-time source counts, chunk counts, character counts, and workspace metrics.
- **🔍 Global Quick Search (`Ctrl+K`)** – Instant modal search across collections and quick prompts.
- **📖 Source Preview Modal** – Inspect raw chunk content with pagination and similarity scores.
- **⚡ Ultra-low Latency Inference** – Powered by Groq LPUs (`qwen/qwen3.8-27b`) for rapid generation.
- **🛡️ Resilient Vector Storage** – Supabase Postgres + `pgvector` with HNSW cosine distance indexing and resilient connection pooling.
- **📱 Responsive Layout** – Desktop, tablet, and mobile layouts with a dedicated mobile bottom navigation bar.
- **🐳 Docker Compose** – One-command containerized deployment.

---

## 🏗️ Architecture & Pipeline

```
                        ┌─────────────────────────┐
                        │   KnowledgeFlow Web UI   │
                        │   Next.js 16 (App Router)│
                        └───────────┬─────────────┘
                                    │ HTTP / JSON
                                    ▼
                        ┌─────────────────────────┐
                        │   FastAPI Backend (Python)│
                        └───────────┬─────────────┘
              ┌─────────────────────┴──────────────────────┐
              ▼ Ingestion Pipeline                         ▼ Query Pipeline
  ┌───────────────────────┐                   ┌───────────────────────┐
  │ Multi-Source Loaders  │                   │  User Query + Persona  │
  │ PDF|DOCX|PPTX|Web|YT  │                   └───────────┬───────────┘
  └───────────┬───────────┘                               │ embed
              │ raw text                                  ▼
              ▼                               ┌───────────────────────┐
  ┌───────────────────────┐                   │ SentenceTransformers   │
  │ Clean + Normalize     │                   │ all-MiniLM-L6-v2 (384d)│
  └───────────┬───────────┘                   └───────────┬───────────┘
              │                                           │ query vector
              ▼                                           │
  ┌───────────────────────┐                               │
  │ Sliding Chunk (650c,  │                               │
  │   120 overlap)        │                               │
  └───────────┬───────────┘                               │
              │ embed                                     │
              ▼                                           │
  ┌───────────────────────────────────────────────────────┴──┐
  │              Supabase Postgres + pgvector                  │
  │  rag_documents | rag_chunks | match_rag_chunks() [HNSW]   │
  └───────────────────────────┬──────────────────────────────┘
                              │ Top-K chunks (cosine similarity)
                              ▼
                  ┌───────────────────────┐
                  │       Groq API        │
                  │  qwen/qwen3.8-27b     │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Grounded Answer +    │
                  │  Source Citations     │
                  └───────────────────────┘
```

---

## 🗄️ Database Setup (Supabase / pgvector)

Run the following SQL in your **Supabase SQL Editor**:

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Source document metadata table
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    content_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_collection_source UNIQUE (collection_name, source_type, source_name)
);

-- 3. Document chunks + vector embeddings table
CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES rag_documents(id) ON DELETE CASCADE,
    collection_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    char_count INT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
ON rag_chunks
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. Top-K semantic search function
CREATE OR REPLACE FUNCTION match_rag_chunks (
    query_embedding extensions.vector(384),
    target_collection TEXT,
    match_count INT DEFAULT 4
)
RETURNS TABLE (
    id UUID, collection_name TEXT, source_type TEXT, source_name TEXT,
    chunk_index INT, content TEXT, score FLOAT, metadata JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT id, collection_name, source_type, source_name, chunk_index, content,
           ROUND((1.0 - (embedding <=> query_embedding))::numeric, 4)::float AS score,
           metadata
    FROM rag_chunks
    WHERE collection_name = target_collection
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Recommended Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ (tested with v20+) |
| [Supabase](https://supabase.com) account | Free tier (with pgvector enabled) |
| [Groq Cloud](https://console.groq.com) API key | Free tier |

---

### 1. Clone the Repository

```bash
git clone https://github.com/Chethan13032005/KnowledgeFlow.git
cd KnowledgeFlow
```

### 2. Configure Environment Variables

```bash
cd backend
cp .env.example .env
# Edit .env and supply your GROQ_API_KEY and DATABASE_URL
```

**`backend/.env` configuration guide:**

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq Cloud API key from [console.groq.com](https://console.groq.com) |
| `DATABASE_URL` | Supabase Postgres direct connection string |
| `GROQ_MODEL` | LLM model name (default: `qwen/qwen3.8-27b`) |
| `EMBEDDING_MODEL` | Local embedding model (default: `sentence-transformers/all-MiniLM-L6-v2`) |
| `DB_POOL_MAX_SIZE` | Database connection pool size (default: `5`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin (default: `http://localhost:3000`) |

### 3. Run Locally

#### Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API root: `http://127.0.0.1:8000`
- Interactive OpenAPI docs: `http://127.0.0.1:8000/docs`

#### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

### 4. Docker Compose (One-Command Deployment)

Make sure `backend/.env` is configured, then run from the project root:

```bash
docker-compose up --build -d
```

| Service | Access URL |
|---|---|
| Frontend Web UI | `http://localhost:3000` |
| Backend API Docs | `http://localhost:8000/docs` |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Healthcheck (validates backend and database connectivity) |
| `GET` | `/analytics` | Global stats: total documents, chunks, and characters |
| `GET` | `/collections` | List all unique collections with source counts |
| `GET` | `/collections/{name}/stats` | Detailed stats for a specific collection |
| `GET` | `/collections/{name}/sources` | List all sources in a collection |
| `DELETE` | `/collections/{name}` | Delete an entire collection and all associated vectors |
| `POST` | `/ingest/text` | Ingest raw text or paste notes |
| `POST` | `/ingest/file` | Upload and chunk PDF, DOCX, PPTX, TXT, or MD |
| `POST` | `/ingest/url` | Scrape and ingest website article |
| `POST` | `/ingest/youtube` | Fetch transcript and ingest YouTube video |
| `POST` | `/query` | Execute top-k vector retrieval and generate grounded response |

---

## 🧱 Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, CSS variables design system |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 |
| **LLM Inference** | Groq Cloud LPUs (`qwen/qwen3.8-27b`) |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors) |
| **Vector Database** | Supabase PostgreSQL with `pgvector` and HNSW indexing |
| **Document Loaders** | PyMuPDF (fitz), python-docx, python-pptx |
| **Web & Video** | BeautifulSoup4, httpx, youtube-transcript-api |
| **Containerization** | Docker, Docker Compose |

---

## 🤝 Contributing

Contributions are welcome!
1. Fork the repository
2. Create your branch (`git checkout -b feat/feature-name`)
3. Commit your changes (`git commit -m "feat: description of feature"`)
4. Push to the branch (`git push origin feat/feature-name`)
5. Open a Pull Request

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
