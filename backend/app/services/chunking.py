from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TextChunk:
    document_id: int
    chunk_index: int
    text: str
    metadata: dict[str, Any]


def chunk_text(
    text: str,
    *,
    document_id: int,
    source: dict[str, Any] | None = None,
    chunk_size: int = 650,
    overlap: int = 100,
) -> list[TextChunk]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")

    words = text.split()
    if not words:
        return []

    chunks: list[TextChunk] = []
    start = 0
    chunk_index = 0
    base_metadata = dict(source or {})

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunks.append(
            TextChunk(
                document_id=document_id,
                chunk_index=chunk_index,
                text=" ".join(chunk_words),
                metadata={**base_metadata, "word_start": start, "word_end": end},
            )
        )
        if end == len(words):
            break
        start = end - overlap
        chunk_index += 1

    return chunks
