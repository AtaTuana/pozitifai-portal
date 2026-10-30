"""Stable rule identities shared by the cleaner, audit trail and upload interface."""

from dataclasses import dataclass, field
from decimal import Decimal

RULESET_VERSION = "1.1"
RULE_VERSIONS = {"DQ-013": 2}
Q1 = "Q1-v1"
WEIGHTS = (Decimal("0.25"), Decimal("0.40"), Decimal("0.35"))
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_FILES = 50
MAX_ROWS = 20000
HEADERS = {
    "calls": ("call_id", "temsilci_id", "baslangic", "sure_sn", "sonuc", "kampanya"),
    "agents": ("temsilci_id", "ad_soyad", "takim", "ise_baslama"),
    "quality": (
        "call_id",
        "degerlendiren",
        "toplam_puan",
        "selamlama",
        "ihtiyac_analizi",
        "kapanis",
    ),
}
RULES = {
    "DQ-001": "UTF-8 / BOM kodlaması",
    "DQ-002": "CSV sütun ve satır yapısı",
    "DQ-003": "Ondalık sayı biçimi",
    "DQ-004": "Metin ve ad standartlaştırma",
    "DQ-005": "Kaynak kimliği",
    "DQ-006": "Tam tekrar",
    "DQ-007": "Aynı kimlikte çelişki",
    "DQ-008": "Açık tarih biçimleri",
    "DQ-009": "Kanıtla tarih yorumlama",
    "DQ-010": "Kurtarılamayan tarih",
    "DQ-011": "Güncel temsilci ve takım eşleştirmesi",
    "DQ-012": "Geçersiz veya eksik süre",
    "DQ-013": "Çağrı sonucu",
    "DQ-014": "Kalite sınırı ve hassasiyeti",
    "DQ-015": "Toplam kalite puanını yeniden hesaplama",
    "DQ-016": "Tek alt puanın aday aralığı",
    "DQ-017": "Belirsiz kalite hatası",
    "DQ-018": "Çağrı eşleşmesi bekleme",
    "DQ-019": "Kalite yokluğunu boş bırakma",
    "DQ-020": "Alan bazında işlem izi",
    "DQ-021": "Yeniden yükleme ve kayıt bütünlüğü",
}


@dataclass
class Finding:
    code: str
    field: str
    message: str
    before: object = None
    after: object = None
    operation: str = "review"
    effect: str = ""
    evidence: dict = field(default_factory=dict)


@dataclass
class SourceRow:
    number: int
    raw: dict
    reference: str = ""
    values: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)
    status: str = "pending"

    def note(
        self,
        code,
        field_name,
        message,
        before=None,
        after=None,
        *,
        operation="review",
        effect="",
        **evidence
    ):
        """Append in execution order; the immutable source value remains in raw."""
        self.findings.append(
            Finding(
                code, field_name, message, before, after, operation, effect, evidence
            )
        )

    def quarantine(self, code, field_name, message, **evidence):
        self.status = "quarantined"
        self.note(
            code,
            field_name,
            message,
            self.raw.get(field_name),
            operation="quarantine",
            effect="Bu kaynak satırı rapora alınmadı.",
            **evidence
        )
