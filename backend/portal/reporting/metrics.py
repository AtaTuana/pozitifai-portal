"""Keep additive inputs so every ratio and weighted average can be recomputed."""

from decimal import Decimal
from django.db.models import BigIntegerField, Count, F, Q, Sum
from django.db.models.functions import Cast, Round
from portal.models import Result

REACHED_IDS = (Result.Id.SALE, Result.Id.REJECTED, Result.Id.CALLBACK)
KNOWN_IDS = (*REACHED_IDS, Result.Id.UNREACHABLE)
QUALITY_COMPONENTS = {
    "greeting": "greeting_score",
    "needAnalysis": "need_analysis_score",
    "closure": "closure_score",
}


def component_aggregates():
    """Each optional subscore has its own denominator; missing scores are never zero."""
    result = {}
    for name, field in QUALITY_COMPONENTS.items():
        path = f"quality_score__{field}"
        valid = Q(**{f"{path}__gte": 0, f"{path}__lte": 100})
        result[f"{name}_count"] = Count("quality_score", filter=valid)
        result[f"{name}_sum_hundredths"] = Sum(
            Cast(Round(F(path) * 100), BigIntegerField()),
            filter=valid,
            default=0,
            output_field=BigIntegerField(),
        )
    return result


def aggregates():
    reached = Q(result_id__in=REACHED_IDS)
    valid_duration = Q(duration_seconds__gte=0, duration_seconds__lte=32767)
    valid_quality = Q(
        quality_score__total_score__gte=0, quality_score__total_score__lte=100
    )
    # Scores have two decimal places. Sum integer hundredths to avoid SQLite float drift.
    score_hundredths = Cast(
        Round(F("quality_score__total_score") * 100), BigIntegerField()
    )
    return {
        **component_aggregates(),
        "total_calls": Count("pk"),
        "sales_calls": Count("pk", filter=Q(result_id=Result.Id.SALE)),
        "rejected_calls": Count("pk", filter=Q(result_id=Result.Id.REJECTED)),
        "callback_calls": Count("pk", filter=Q(result_id=Result.Id.CALLBACK)),
        "unreachable_calls": Count("pk", filter=Q(result_id=Result.Id.UNREACHABLE)),
        "unknown_result_calls": Count(
            "pk", filter=Q(result_id__isnull=True) | ~Q(result_id__in=KNOWN_IDS)
        ),
        "talk_duration_count": Count("pk", filter=reached & valid_duration),
        "talk_duration_sum": Sum(
            "duration_seconds",
            filter=reached & valid_duration,
            default=0,
            output_field=BigIntegerField(),
        ),
        "quality_count": Count("quality_score", filter=valid_quality),
        "quality_sum_hundredths": Sum(
            score_hundredths,
            filter=valid_quality,
            default=0,
            output_field=BigIntegerField(),
        ),
        "undated_calls": Count("pk", filter=Q(started_at__isnull=True)),
        "unknown_agent_calls": Count("pk", filter=Q(agent_id__isnull=True)),
        "unassigned_team_calls": Count("pk", filter=Q(report_team_id__isnull=True)),
        "invalid_duration_calls": Count("pk", filter=~valid_duration),
    }


def divide(numerator, denominator, multiplier=1):
    return float(Decimal(numerator) * multiplier / denominator) if denominator else None


def metrics(values):
    """Only derived numbers use floating-point JSON; exact additive inputs remain available."""
    reached = (
        values["sales_calls"] + values["rejected_calls"] + values["callback_calls"]
    )
    quality_sum = Decimal(values["quality_sum_hundredths"]) / 100
    return {
        "totalCalls": values["total_calls"],
        "reachedCalls": reached,
        "unreachableCalls": values["unreachable_calls"],
        "salesCalls": values["sales_calls"],
        "rejectedCalls": values["rejected_calls"],
        "callbackCalls": values["callback_calls"],
        "unknownResultCalls": values["unknown_result_calls"],
        "reachRate": divide(reached, values["total_calls"], 100),
        "conversionRate": divide(values["sales_calls"], reached, 100),
        "averageTalkSeconds": divide(
            values["talk_duration_sum"], values["talk_duration_count"]
        ),
        "averageQualityScore": divide(quality_sum, values["quality_count"]),
        "qualityComponents": {
            name: {
                "averageScore": divide(
                    Decimal(values[f"{name}_sum_hundredths"]) / 100,
                    values[f"{name}_count"],
                ),
                "scoreCount": values[f"{name}_count"],
                "scoreSum": format(
                    Decimal(values[f"{name}_sum_hundredths"]) / 100, ".2f"
                ),
            }
            for name in QUALITY_COMPONENTS
        },
        "basis": {
            "talkSecondsSum": values["talk_duration_sum"],
            "talkDurationCount": values["talk_duration_count"],
            "qualityScoreSum": format(quality_sum, ".2f"),
            "qualityScoreCount": values["quality_count"],
        },
        "coverage": {
            "undatedCalls": values["undated_calls"],
            "unknownAgentCalls": values["unknown_agent_calls"],
            "unassignedTeamCalls": values["unassigned_team_calls"],
            "missingOrInvalidDurationCalls": values["invalid_duration_calls"],
            "reachedWithoutDurationCalls": reached - values["talk_duration_count"],
            "withoutUsableQualityCalls": values["total_calls"]
            - values["quality_count"],
        },
    }
