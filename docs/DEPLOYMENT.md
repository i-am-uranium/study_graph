# StudyGraph Deployment

StudyGraph can run locally or in production with Docker Compose. The production compose file is intentionally conservative: persistent volumes, restart policies, database health checks, and static frontend serving through Nginx.

## Required Secrets

Create a `.env` file on the deployment host.

```bash
POSTGRES_PASSWORD=replace-with-a-long-random-password
OPENAI_API_KEY=replace-with-provider-key
OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_MODEL=gpt-4.1-mini
EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGINS=https://studygraph.example.com
PUBLIC_API_BASE_URL=/api
FRONTEND_PORT=8080
```

Use any OpenAI-compatible provider that supports `/chat/completions` and `/embeddings`.

## Start Production Services

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The API container runs Alembic migrations before starting. The worker container also runs migrations before polling queued documents.

## Reverse Proxy

Put a TLS-terminating reverse proxy in front of the frontend container. Route public traffic to `FRONTEND_PORT`, which defaults to `8080`.

The bundled frontend Nginx proxies:

- `/api/*` to the backend API service
- `/health` to the backend health endpoint
- all other routes to the React app

## Persistent Data

Production compose creates two named volumes:

- `postgres_data`: database data, document metadata, chunks, embeddings, sessions, artifacts
- `uploaded_files`: original uploaded documents

Back up both volumes. Database backups alone are not enough because the original uploaded files are stored separately.

## Backups

Example Postgres backup:

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U studygraph studygraph > studygraph.sql
```

Also snapshot or copy the `uploaded_files` Docker volume.

## Operational Notes

- Keep `OPENAI_API_KEY` only in `.env` or your secret manager.
- Do not expose the API service directly unless you also configure CORS and authentication for your deployment.
- v0.1 is designed for single-tenant or trusted deployments. Classroom multi-user roles are planned in the roadmap.
- Embedding dimensions must match the configured embedding model before data is ingested.
- For larger libraries, tune Postgres memory and pgvector index settings.

