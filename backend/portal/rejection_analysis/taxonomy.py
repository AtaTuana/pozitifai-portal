"""The nine categories and the prompt supplied by the project owner."""

import hashlib
import os
from pathlib import Path

CATEGORIES = (
    "Güven Eksikliği",
    "İlgilenmiyor",
    "Düşünceli",
    "Müsait Değil",
    "Fiyat",
    "Rakip Firma",
    "Satış Kanalı",
    "Gizlilik",
    "Dijital Platform",
)
CATEGORY_IDS = {name: index + 1 for index, name in enumerate(CATEGORIES)}
PROMPT_VERSION = 1
PROMPT_NAME = "ret-siniflandirma"


def prompt_content():
    return (Path(__file__).parent / "prompts" / "rejection-v1.txt").read_text(
        encoding="utf-8"
    )


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def model_name():
    return os.environ.get("OPENAI_MODEL", "gpt-6-luna").strip() or "gpt-6-luna"
