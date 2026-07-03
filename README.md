# StudyGraph

StudyGraph is a local app/data agentic RAG study preparation platform. Upload PDF, DOCX, TXT, or Markdown learning materials, then ask cited questions, generate summaries, and build flashcards from your own documents.

The app is designed for local development first while remaining deployable in production. The default stack is fully open-source and runs locally: application services, uploaded files, database data, and all LLM, embedding, and reranking calls run in your environment with no external API keys. A remote OpenAI-compatible provider is still optionally supported.

## Features

- PDF, DOCX, TXT, and Markdown upload.
- Fully OSS, local-by-default model stack: `qwen3:8b` chat and `qwen3-embedding:0.6b` embeddings via Ollama, and `BAAI/bge-reranker-v2-m3` reranking via an Infinity server (all Apache 2.0).
- Local Postgres storage with pgvector at 1024 dimensions.
- Document parsing, chunking, embedding, and reranked retrieval.
- Cited Q&A over selected documents or the full library.
- Summaries and flashcards saved as study artifacts.
- FastAPI backend and separate React frontend.
- Docker Compose for local and production-like runs.

## Local Development

1. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

2. No API key is required. The default stack runs entirely locally.

3. Start services:

   ```bash
   docker compose up --build
   ```

   This starts Ollama, pulls the `qwen3:8b` chat and `qwen3-embedding:0.6b`
   embedding models automatically (via the one-shot `ollama-init` service), and
   starts the Infinity reranker. The first boot is slow because it downloads
   several gigabytes of models; subsequent boots reuse the cached models.

   > **Apple Silicon note:** the Infinity reranker image is `linux/amd64`, so on
   > an M-series Mac it runs under emulation and is memory-hungry. Give Docker
   > Desktop at least ~10–12 GB of RAM (Settings → Resources), or run the reranker
   > natively on the host instead (see `scripts/pull-models.sh`). If the reranker
   > exits with code 137 (OOM), that is the cause.

4. Open the frontend:

   ```text
   http://localhost:5173
   ```

The API is available at `http://localhost:8000`. Ollama runs on `11434` and the
reranker on `7997`.

First-run model downloads can take several minutes. If a document fails to ingest
before the models are ready, wait for the `ollama-init` service to finish, then run
ingestion again for that document.

## Development Without Docker

Models: with [Ollama](https://ollama.com) installed and running, pull the local
models and start the reranker.

```bash
scripts/pull-models.sh
```

This pulls the `qwen3:8b` and `qwen3-embedding:0.6b` Ollama models and prints the
Docker command for the Infinity reranker. Start the reranker with:

```bash
docker run -p 7997:7997 michaelf34/infinity:latest \
  v2 --model-id BAAI/bge-reranker-v2-m3 --port 7997
```

Ollama serves on `11434` and the reranker on `7997`; the backend talks to both by
default.

Backend:

```bash
cp .env.example .env
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Worker:

```bash
cd backend
source .venv/bin/activate
python -m app.worker
```

When the backend and worker are started from `backend/`, StudyGraph still reads the
root `.env`. You can also export provider variables in the terminal before starting
both processes.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend toolchain requires Node `^20.19.0` or `>=22.12.0`.

## Production

Use `docker-compose.prod.yml` as the starting point for production deployments:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for required secrets, volumes, migrations, reverse proxy expectations, and backup guidance.

## Roadmap

The classroom roadmap is tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
