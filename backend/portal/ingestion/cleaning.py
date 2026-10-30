"""Pure row decisions: preserve evidence, never infer an outcome from duration."""

from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from .outcomes import RESULT_LABELS, resolve_result
from .parsing import (
    ID_PATTERN,
    explicit_datetime,
    number_field,
    parse_started,
    text_field,
)
from .rules import Q1, WEIGHTS

SCORE_FIELDS = ("toplam_puan", "selamlama", "ihtiyac_analizi", "kapanis")


def identify_rows(rows, kind):
    """Reject all members of a conflicting source group; keep one exact duplicate."""
    field_name = "temsilci_id" if kind == "agents" else "call_id"
    groups = defaultdict(list)
    for row in rows:
        if row.status == "quarantined":
            continue
        value = text_field(row, field_name)
        if not ID_PATTERN.fullmatch(value):
            row.quarantine(
                "DQ-005",
                field_name,
                "Kimlik 1–12 karakter olmalı: A–Z, 0–9, alt çizgi veya tire.",
            )
            continue
        row.reference = value
        groups[value].append(row)
    for group in groups.values():
        if any(row.raw != group[0].raw for row in group[1:]):
            for row in group:
                row.quarantine(
                    "DQ-007",
                    field_name,
                    "Aynı kimlikte farklı kaynak satırları var; birini seçerek üzerine yazılmadı.",
                    sourceRows=[item.number for item in group],
                )
        else:
            for row in group[1:]:
                row.status = "duplicate"
                row.note(
                    "DQ-006",
                    field_name,
                    "Bütün kaynak alanları aynı olan fazla satır çıkarıldı.",
                    row.reference,
                    row.reference,
                    operation="duplicate",
                    effect="Çağrı sayısını artırmaz.",
                    retainedRow=group[0].number,
                )


def clean_call(row, period, clear_dates):
    campaign = text_field(row, "kampanya")
    if not usable_name(campaign):
        row.quarantine(
            "DQ-004",
            "kampanya",
            "Kampanya adı boş, çok uzun veya kontrol karakteri içeriyor.",
        )
        return
    duration = number_field(row, "sure_sn")
    if (
        duration is None
        or duration < 0
        or duration > 32767
        or duration != duration.to_integral_value()
    ):
        duration = None
        row.note(
            "DQ-012",
            "sure_sn",
            "Süre boş bırakıldı; mutlak değer veya ortalama kullanılmadı.",
            row.raw.get("sure_sn"),
            None,
            operation="omit",
            effect="Süre ortalamasından çıkarılır; çağrı ve bilinen sonuç korunur.",
        )
    result_text = text_field(row, "sonuc")
    result_id = resolve_result(result_text)
    if result_id is None:
        row.note(
            "DQ-013",
            "sonuc",
            "Sonuç bilinmiyor; süreden sonuç tahmini yapılmadı.",
            result_text,
            None,
            operation="omit",
            effect="Toplam çağrıya dahil; bilinen sonuç sayılarına dahil değil.",
        )
    elif result_text != RESULT_LABELS[result_id]:
        row.note(
            "DQ-013",
            "sonuc",
            "Bilinen sonuç etiketi Türkçe harf ve büyük/küçük harf karşılıklarıyla eşleştirildi.",
            result_text,
            RESULT_LABELS[result_id],
            operation="normalize",
            resultId=result_id,
        )
    row.values = {
        "agent_reference": text_field(row, "temsilci_id"),
        "campaign_name": campaign,
        "started_at": parse_started(row, period, clear_dates),
        "duration_seconds": int(duration) if duration is not None else None,
        "result_id": result_id,
    }


def usable_name(value):
    return (
        bool(value)
        and len(value) <= 150
        and not any(ord(c) < 32 or 127 <= ord(c) < 160 for c in value)
    )


def clean_agent(row):
    name, team = text_field(row, "ad_soyad"), text_field(row, "takim")
    if not usable_name(name) or not usable_name(team):
        row.quarantine(
            "DQ-011",
            "ad_soyad",
            "Ad ve takım 1–150 karakter olmalı; kontrol karakteri içermemeli.",
        )
        return
    started = text_field(row, "ise_baslama")
    start_date = None
    for pattern in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            start_date = datetime.strptime(started, pattern).date().isoformat()
            break
        except ValueError:
            continue
    if started and start_date is None:
        row.note(
            "DQ-010",
            "ise_baslama",
            "İşe başlama tarihi kurtarılamadı; temsilci kaydı korunur.",
            started,
            None,
            operation="omit",
        )
    elif start_date and start_date != started:
        row.note(
            "DQ-008",
            "ise_baslama",
            "İşe başlama tarihi standartlaştırıldı.",
            started,
            start_date,
            operation="normalize",
        )
    row.values = {"name": name, "team_name": team, "start_date": start_date}


def clean_quality(row, profile):
    """Q1 repairs a known invalid total; it never picks an arbitrary wrong variable."""
    rater = text_field(row, "degerlendiren")
    values = [number_field(row, field) for field in SCORE_FIELDS]
    invalid = [
        i
        for i, value in enumerate(values)
        if value is None
        or not 0 <= value <= 100
        or value != value.quantize(Decimal("0.01"))
    ]
    for index in invalid:
        row.note(
            "DQ-014",
            SCORE_FIELDS[index],
            "Puan eksik, 0–100 dışında veya desteklenen iki ondalık hassasiyetini aşıyor.",
            row.raw.get(SCORE_FIELDS[index]),
            None,
            operation="omit",
        )
        values[index] = None
    eligible = usable_name(rater)
    if not eligible:
        row.note(
            "DQ-014",
            "degerlendiren",
            "Değerlendirici adı boş veya geçersiz.",
            rater,
            None,
            effect="Kalite rapora alınmaz; çağrı korunur.",
        )
    if profile == Q1 and invalid == [0]:
        exact = sum(value * weight for value, weight in zip(values[1:], WEIGHTS))
        values[0] = exact.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        row.note(
            "DQ-015",
            "toplam_puan",
            "Geçerli üç alt puanla Q1 toplamı yeniden hesaplandı.",
            row.raw.get("toplam_puan"),
            str(values[0]),
            operation="recalculate",
            effect="Yeniden hesaplandığı işaretlenerek kalite hesabına alınır.",
            profile=Q1,
            weights=[str(w) for w in WEIGHTS],
            exact=str(exact),
            storagePrecision="0.01 / ROUND_HALF_UP",
        )
    elif len(invalid) > 1 or 0 in invalid:
        eligible = False
        row.note(
            "DQ-017",
            "",
            "Birden fazla puan geçersiz veya toplamı onaracak profil yok.",
            operation="review",
            effect="Kalite rapora alınmaz; çağrı korunur.",
        )
    elif profile == Q1 and len(invalid) == 1:
        index = invalid[0]
        known = sum(
            value * weight
            for value, weight in zip(values[1:], WEIGHTS)
            if value is not None
        )
        # No integer subscore contract is proven for this source.
        tolerance = rounding_tolerance(values[0])
        low = max(Decimal(0), (values[0] - tolerance - known) / WEIGHTS[index - 1])
        high = min(Decimal(100), (values[0] + tolerance - known) / WEIGHTS[index - 1])
        if low > high:
            eligible = False
        row.note(
            "DQ-016",
            SCORE_FIELDS[index],
            "Alt puan hassasiyet sözleşmesi yok; ters denklemin aralığı tek bir gerçek değer kanıtlamaz.",
            row.raw.get(SCORE_FIELDS[index]),
            None,
            effect="Alt puan boş kalır. Uygun aday aralığı varsa mevcut toplam korunur.",
            profile=Q1,
            minimum=str(low),
            maximum=str(high),
            feasible=low <= high,
        )
    elif profile == Q1 and not invalid:
        expected = sum(value * weight for value, weight in zip(values[1:], WEIGHTS))
        tolerance = rounding_tolerance(values[0])
        if abs(values[0] - expected) > tolerance:
            eligible = False
            row.note(
                "DQ-017",
                "toplam_puan",
                "Puanların hepsi aralık içinde, fakat Q1 denklemi tutarsız; yanlış alan seçilmedi.",
                str(values[0]),
                str(values[0]),
                effect="Kalite rapora alınmaz; çağrı korunur.",
                profile=Q1,
                expected=str(expected),
                absoluteDifference=str(abs(values[0] - expected)),
                tolerance=str(tolerance),
            )
    row.values = {
        "rater_name": rater,
        "scores": [str(value) if value is not None else None for value in values],
        "eligible": eligible,
        "profile": profile,
    }


def rounding_tolerance(total):
    return Decimal("0.05") if total.as_tuple().exponent >= -1 else Decimal("0.005")


def clean_rows(rows, kind, options):
    identify_rows(rows, kind)
    clear_dates = [
        date
        for row in rows
        if row.status == "pending"
        and (date := explicit_datetime(row.raw.get("baslangic", "").strip()))
    ]
    for row in rows:
        if row.status != "pending":
            continue
        if kind == "calls":
            clean_call(row, options.get("period"), clear_dates)
        elif kind == "agents":
            clean_agent(row)
        elif kind == "quality":
            clean_quality(row, options.get("profile", "none"))
