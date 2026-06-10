from dataclasses import dataclass
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


@dataclass(frozen=True)
class ParsedDocument:
    text: str
    metadata: dict


def parse_document(path: Path, content_type: str) -> ParsedDocument:
    normalized = content_type.lower().split(";")[0].strip()
    suffix = path.suffix.lower()

    if normalized in {"text/plain", "text/markdown"} or suffix in {".txt", ".md", ".markdown"}:
        source_type = (
            "markdown"
            if suffix in {".md", ".markdown"} or normalized == "text/markdown"
            else "text"
        )
        return ParsedDocument(
            text=path.read_text(encoding="utf-8", errors="replace"),
            metadata={"source_type": source_type},
        )

    if normalized == "application/pdf" or suffix == ".pdf":
        reader = PdfReader(str(path))
        page_text = []
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                page_text.append(f"\n\n[Page {index + 1}]\n{text}")
        return ParsedDocument(
            text="\n".join(page_text).strip(),
            metadata={"source_type": "pdf", "page_count": len(reader.pages)},
        )

    if (
        normalized
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or suffix == ".docx"
    ):
        doc = DocxDocument(str(path))
        paragraphs = [paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()]
        return ParsedDocument(
            text="\n".join(paragraphs),
            metadata={"source_type": "docx", "paragraph_count": len(paragraphs)},
        )

    raise ValueError(f"Unsupported document type: {content_type or suffix}")
