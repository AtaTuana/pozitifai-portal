"""One bounded Responses request; provider errors never expose credentials or bodies."""

from dataclasses import dataclass
import json
import os
import socket
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from portal.http import ApiError
from .taxonomy import CATEGORIES

REQUEST_TIMEOUT = 45


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class Classification:
    categories: tuple[str, ...]
    raw_response: str
    input_tokens: int | None
    output_tokens: int | None
    duration_ms: int


def validate_output(text, filename):
    """Validate semantics as well as JSON, including the call-to-answer association."""
    try:
        value = json.loads(text)
    except (TypeError, ValueError):
        value = None
    if not isinstance(value, dict) or set(value) != {"dosya", "sebepler"}:
        raise ApiError(
            "LLM104", "Modelin yanıtı beklenen sınıflandırma biçiminde değil.", 502
        )
    labels = value["sebepler"]
    if (
        value["dosya"] != filename
        or not isinstance(labels, list)
        or len(labels) > 2
        or any(
            not isinstance(label, str) or label not in CATEGORIES for label in labels
        )
        or len(set(labels)) != len(labels)
    ):
        raise ApiError(
            "LLM104", "Modelin kategori veya çağrı eşleşmesi doğrulanamadı.", 502
        )
    return tuple(labels)


def classify(*, call_id, transcript, prompt, model):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise ApiError(
            "LLM001",
            "API anahtarı tanımlı değil. Yerel ayarları kaydedip start.bat dosyasını yeniden başlat.",
            503,
        )
    if len(transcript) > 60000:
        raise ApiError(
            "LLM107",
            "Konuşma tek analiz için çok uzun; yüklenen metni kontrol et.",
            422,
        )
    filename = f"{call_id}.txt"
    payload = {
        "model": model,
        "instructions": prompt,
        "input": json.dumps(
            {"dosya": filename, "konusma": transcript}, ensure_ascii=False
        ),
        "reasoning": {"effort": "none"},
        "max_output_tokens": 256,
        "store": False,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "rejection_classification",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "dosya": {"type": "string"},
                        "sebepler": {
                            "type": "array",
                            "maxItems": 2,
                            "items": {"type": "string", "enum": list(CATEGORIES)},
                        },
                    },
                    "required": ["dosya", "sebepler"],
                },
            }
        },
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.monotonic()
    try:
        with build_opener(NoRedirect).open(
            request, timeout=REQUEST_TIMEOUT
        ) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("Response limit")
        result = json.loads(raw)
    except HTTPError as exc:
        # A provider 401 is not a portal session failure; keep the user signed in.
        if exc.code in (401, 403):
            raise ApiError(
                "LLM101",
                "API anahtarı veya model erişimi kabul edilmedi. OpenAI proje ayarlarını kontrol et.",
                502,
            ) from None
        if exc.code == 429:
            raise ApiError(
                "LLM102",
                "API kullanım sınırına ulaşıldı. Kredi ve limitlerini kontrol edip yeniden dene.",
                429,
            ) from None
        raise ApiError(
            "LLM103",
            "Model isteği tamamlanamadı. Model ayarını kontrol edip daha sonra yeniden dene.",
            502,
        ) from None
    except (URLError, TimeoutError, socket.timeout, OSError):
        raise ApiError(
            "LLM105",
            "Modelden zamanında yanıt alınamadı. Bağlantıyı kontrol edip yeniden dene.",
            504,
        ) from None
    except (ValueError, UnicodeDecodeError):
        raise ApiError(
            "LLM104", "Modelden okunabilir bir yanıt alınamadı.", 502
        ) from None

    if not isinstance(result, dict) or result.get("status") != "completed":
        raise ApiError("LLM104", "Model yanıtı tamamlanmadı; sonuç kaydedilmedi.", 502)
    output = result.get("output", [])
    if not isinstance(output, list):
        raise ApiError("LLM104", "Model yanıtı doğrulanamadı.", 502)
    parts = [
        part
        for item in output
        if isinstance(item, dict) and isinstance(item.get("content"), list)
        for part in item["content"]
        if isinstance(part, dict)
    ]
    if any(part.get("type") == "refusal" for part in parts):
        raise ApiError(
            "LLM106",
            "Model bu konuşmayı sınıflandırmayı reddetti; sonuç üretilmedi.",
            422,
        )
    text_parts = [
        part.get("text") for part in parts if part.get("type") == "output_text"
    ]
    if any(not isinstance(part, str) for part in text_parts):
        raise ApiError("LLM104", "Model yanıtı metin olarak doğrulanamadı.", 502)
    text = "".join(text_parts)
    labels = validate_output(text, filename)
    usage = result.get("usage") if isinstance(result.get("usage"), dict) else {}

    def tokens(name):
        value = usage.get(name)
        return value if type(value) is int and 0 <= value <= 2_147_483_647 else None

    return Classification(
        labels,
        text,
        tokens("input_tokens"),
        tokens("output_tokens"),
        round((time.monotonic() - started) * 1000),
    )
