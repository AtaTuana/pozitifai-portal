"""Match only known outcome labels after narrowly defined Turkish letter folding."""

from .parsing import clean_text

RESULT_LABELS = {1: "satis", 2: "ret", 3: "geri_ara", 4: "ulasilamadi"}
_RESULT_IDS = {label: result_id for result_id, label in RESULT_LABELS.items()}
_RESULT_IDS["geri ara"] = 3
_TURKISH_I = str.maketrans({"I": "i", "İ": "i", "ı": "i"})


def resolve_result(value):
    """Accept mixed ş/s and ı/i spellings, never fuzzy-match unknown outcomes."""
    normalized = clean_text(value).translate(_TURKISH_I).casefold().replace("ş", "s")
    return _RESULT_IDS.get(normalized)
