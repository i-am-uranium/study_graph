#!/usr/bin/env bash
set -euo pipefail

# pull-models.sh
#
# Provision the OSS-local model stack for StudyGraph when running WITHOUT docker
# compose. It pulls the chat + embedding models into a locally running Ollama
# daemon, then prints the docker command to start the Infinity reranker.
#
# Prerequisites:
#   - Ollama installed and its daemon running (https://ollama.com/download)
#   - Docker (only for the reranker step at the end)
#
# Usage:
#   ./scripts/pull-models.sh
#
# Override the Ollama endpoint via OLLAMA_HOST, e.g.:
#   OLLAMA_HOST=http://127.0.0.1:11434 ./scripts/pull-models.sh

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

CHAT_MODEL="qwen3:8b"
EMBEDDING_MODEL="qwen3-embedding:0.6b"

RERANKER_MODEL="BAAI/bge-reranker-v2-m3"
RERANKER_CONTAINER="studygraph-reranker"
RERANKER_IMAGE="michaelf34/infinity:latest"
RERANKER_VOLUME="studygraph_hf_cache"
RERANKER_PORT="7997"

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
error() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; }

# 1. Verify the ollama CLI is available.
if ! command -v ollama >/dev/null 2>&1; then
  error "'ollama' was not found on your PATH."
  error "Install it from https://ollama.com/download and try again."
  exit 1
fi

# 2. Verify the Ollama daemon is reachable.
info "Checking that the Ollama daemon is reachable at ${OLLAMA_HOST} ..."
if ! curl -fsS "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
  error "Could not reach the Ollama daemon at ${OLLAMA_HOST}/api/tags."
  error "Make sure the daemon is running (start it with 'ollama serve')."
  error "If it listens elsewhere, set OLLAMA_HOST, e.g.:"
  error "  OLLAMA_HOST=http://127.0.0.1:11434 $0"
  exit 1
fi
info "Ollama daemon is up."

# 3. Pull the models. 'ollama pull' is a no-op when the model is already present,
#    so this script is safe to re-run.
export OLLAMA_HOST
info "Pulling chat model: ${CHAT_MODEL}"
ollama pull "${CHAT_MODEL}"

info "Pulling embedding model: ${EMBEDDING_MODEL}"
ollama pull "${EMBEDDING_MODEL}"

info "Ollama models are ready."

# 4. Print how to start the Infinity reranker (it auto-downloads the HF model).
cat <<EOF

------------------------------------------------------------------------
Next: start the Infinity reranker (${RERANKER_MODEL}) with Docker.
It downloads the model on first start and caches it in the named volume.

  docker run -d --name ${RERANKER_CONTAINER} \\
    -p ${RERANKER_PORT}:${RERANKER_PORT} \\
    -v ${RERANKER_VOLUME}:/app/.cache \\
    ${RERANKER_IMAGE} \\
    v2 --model-id ${RERANKER_MODEL} --device cpu --engine torch --port ${RERANKER_PORT}

Once it is healthy, verify with:

  curl http://localhost:${RERANKER_PORT}/health

Set RERANK_BASE_URL=http://localhost:${RERANKER_PORT} in your .env (already the
default in .env.example).
------------------------------------------------------------------------
EOF
