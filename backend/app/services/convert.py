import json
import os


def convert(text: str, ext: str) -> dict:
    """Convert plain text or markdown into a Tiptap document.

    ext: ".txt" or ".md" (case-insensitive).
    """
    md = ext.lower() == ".md"
    doc_content = []
    bullets: list[dict] = []

    def flush_bullets():
        if bullets:
            doc_content.append({"type": "bulletList", "content": bullets.copy()})
            bullets.clear()

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if md:
            level, marker = _heading_level(stripped)
            if level:
                flush_bullets()
                doc_content.append(
                    {
                        "type": "heading",
                        "attrs": {"level": level},
                        "content": [{"type": "text", "text": marker}],
                    }
                )
                continue
            if stripped.startswith(("- ", "* ")):
                bullets.append(
                    {
                        "type": "listItem",
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": stripped[2:]}]}
                        ],
                    }
                )
                continue
        flush_bullets()
        doc_content.append({"type": "paragraph", "content": [{"type": "text", "text": stripped}]})
    flush_bullets()
    return {"type": "doc", "content": doc_content}


def _heading_level(line: str) -> tuple[int, str] | tuple[None, None]:
    for marker, level in (("# ", 1), ("## ", 2), ("### ", 3)):
        if line.startswith(marker):
            return level, line[len(marker):]
    return None, None


MAX_IMPORT_BYTES = 1_000_000
ALLOWED_EXTENSIONS = {".txt", ".md"}


def import_filename(filename: str) -> str:
    base = os.path.basename(filename)
    title, ext = os.path.splitext(base)
    return (title or "Imported document")[:200], ext.lower()
