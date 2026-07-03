# StudyGraph Deployment

StudyGraph can run locally or in production with Docker Compose. The production compose file is intentionally conservative: persistent volumes, restart policies, database health checks, and static frontend serving through Nginx.

## Required Secrets

Create a `.env` file on the deployment host.

`POSTGRES_PASSWORD` is the only required secret. The default model stack is fully
local, so no `OPENAI_API_KEY` is needed: the app talks to the bundled Ollama service
over its OpenAI-compatible API via `OPENAI_BASE_URL`, with no key.

```bash
POSTGRES_PASSWORD=replace-with-a-long-random-password

# Local model stack (no API key required)
OPENAI_BASE_URL=http://ollama:11434/v1
CHAT_MODEL=qwen3:8b
EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBEDDING_DIMENSIONS=1024
SEND_EMBEDDING_DIMENSIONS=false

# Reranker (Infinity sidecar)
RERANK_ENABLED=true
RERANK_BASE_URL=http://reranker:7997
RERANK_MODEL=BAAI/bge-reranker-v2-m3
RETRIEVAL_CANDIDATE_K=30
RETRIEVAL_TOP_K=8

FRONTEND_ORIGINS=https://studygraph.example.com
PUBLIC_API_BASE_URL=/api
FRONTEND_PORT=8080
```

By default StudyGraph runs the models locally with Ollama and the Infinity reranker,
which requires no external credentials. To use a remote OpenAI-compatible provider
instead, set `OPENAI_BASE_URL` to the provider endpoint and add `OPENAI_API_KEY`;
any provider that supports `/chat/completions` and `/embeddings` works.

## Start Production Services

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The API container runs Alembic migrations before starting. The worker waits for the API health check, then polls queued documents.

## Reverse Proxy

Put a TLS-terminating reverse proxy in front of the frontend container. Route public traffic to `FRONTEND_PORT`, which defaults to `8080`.

The bundled frontend Nginx proxies:

- `/api/*` to the backend API service
- `/health` to the backend health endpoint
- all other routes to the React app

## Persistent Data

Production compose creates named volumes:

- `postgres_data`: database data, document metadata, chunks, embeddings, sessions, artifacts
- `uploaded_files`: original uploaded documents
- `ollama_models`: downloaded Ollama models (`qwen3:8b`, `qwen3-embedding:0.6b`)
- `hf_cache`: reranker / Hugging Face model cache

Back up `postgres_data` and `uploaded_files`. Database backups alone are not enough because the original uploaded files are stored separately.

`ollama_models` and `hf_cache` are caches, not critical backups: they are large and can be re-downloaded on the next boot, so they do not need to be included in backups.

## Backups

Example Postgres backup:

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U studygraph studygraph > studygraph.sql
```

Also snapshot or copy the `uploaded_files` Docker volume.

## Operational Notes

- The default local stack needs no provider credentials. If you use a remote provider, keep `OPENAI_API_KEY` only in `.env` or your secret manager, and restart both the API and worker after changing it. Failed documents can be ingested again afterward.
- Do not expose the Ollama (`11434`) or reranker (`7997`) services publicly. They are internal to the compose network and should not be reachable from the internet.
- Do not expose the API service directly unless you also configure CORS and authentication for your deployment.
- v0.1 is designed for single-tenant or trusted deployments. Classroom multi-user roles are planned in the roadmap.
- `EMBEDDING_DIMENSIONS` is baked into the pgvector column when migrations run, and must match what the embedding model returns (`1024` for `qwen3-embedding:0.6b`). Set it before the first `alembic upgrade`; changing it later requires a migration and re-ingestion of all documents. Deployments upgrading from the old OpenAI default (`1536`) must set `EMBEDDING_DIMENSIONS=1024` before migrating and re-ingest every document, since old 1536-dim vectors are incompatible.
- For larger libraries, tune Postgres memory and pgvector index settings.
