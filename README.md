# StudyGraph

StudyGraph is a local app/data agentic RAG study preparation platform. Upload PDF, DOCX, TXT, or Markdown learning materials, then ask cited questions, generate summaries, and build flashcards from your own documents.

The app is designed for local development first while remaining deployable in production. Application services, uploaded files, and database data run in your environment. LLM and embedding calls use provider API keys.

## Features

- PDF, DOCX, TXT, and Markdown upload.
- Local Postgres storage with pgvector.
- Document parsing, chunking, and embedding.
- Cited Q&A over selected documents or the full library.
- Summaries and flashcards saved as study artifacts.
- FastAPI backend and separate React frontend.
- Docker Compose for local and production-like runs.

## Local Development

1. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `OPENAI_API_KEY` or another OpenAI-compatible provider key in `.env`.

3. Start services:

   ```bash
   docker compose up --build
   ```

4. Open the frontend:

   ```text
   http://localhost:5173
   ```

The API is available at `http://localhost:8000`.

If a document fails with `Provider API key is not configured`, set `OPENAI_API_KEY`
in `.env`, restart the API and worker, then run ingestion again for that document.

## Development Without Docker

Backend:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
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
