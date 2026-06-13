from dataclasses import dataclass
from typing import Any

from app.services.providers import OpenAICompatibleProvider
from langchain_core.embeddings import Embeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class TextChunk:
    document_id: int
    chunk_index: int
    text: str
    metadata: dict[str, Any]


class ProviderEmbeddings(Embeddings):
    def __init__(self, provider: OpenAICompatibleProvider) -> None:
        self.provider = provider

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.provider.embed_texts(texts)

    def embed_query(self, text: str) -> list[float]:
        return self.provider.embed_texts([text])[0]


def chunk_text(
    text: str,
    *,
    document_id: int,
    source: dict[str, Any] | None = None,
    chunk_size: int = 650,
    overlap: int = 100,
    provider: OpenAICompatibleProvider | None = None,
) -> list[TextChunk]:

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")

    splits: list[str] = []

    # Try semantic chunking first if provider is available
    if provider is not None:
        try:
            embeddings = ProviderEmbeddings(provider)
            text_splitter = SemanticChunker(embeddings)
            splits = text_splitter.split_text(text)
        except Exception:
            # Fallback to recursive character splitter if semantic splitter fails
            pass

    # Fallback to recursive character splitter if semantic splitter failed or wasn't run
    if not splits:
        # We use a word-count length function to align with the unit test's expectations
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            length_function=lambda x: len(x.split()),
            separators=["\n\n", "\n", " ", ""],
        )
        splits = text_splitter.split_text(text)

    # Convert splits to TextChunk list
    text_chunks = []
    for idx, split_text in enumerate(splits):
        chunk_metadata = dict(source) if source else {}
        text_chunks.append(
            TextChunk(
                document_id=document_id,
                chunk_index=idx,
                text=split_text,
                metadata=chunk_metadata,
            )
        )

    return text_chunks
