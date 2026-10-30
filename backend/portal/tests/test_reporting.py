"""Reporting boundary cases use synthetic records in Django's separate test database."""

from datetime import date, datetime
from decimal import Decimal
from django.contrib.auth.models import AnonymousUser
from django.http import QueryDict
from django.test import RequestFactory, TestCase
from portal.fields import BUSINESS_TIMEZONE
from portal.http import ApiError
from portal.models import (
    Agent,
    AgentTeamAssignment,
    Call,
    Campaign,
    QualityScore,
    Rater,
    Team,
    User,
)
from portal.reporting import ReportQuery, calculate_report, parse_query
from portal.reports import kpis


def local(value):
    return datetime.fromisoformat(value).replace(tzinfo=BUSINESS_TIMEZONE)


class ReportingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.team_a = Team.objects.create(pk="TA", name="Takım A")
        cls.team_b = Team.objects.create(pk="TB", name="Takım B")
        cls.manager = User.objects.create(
            email="manager@example.test", display_name="Manager", role_id="manager"
        )
        cls.captain = User.objects.create(
            email="captain@example.test",
            display_name="Captain",
            role_id="captain",
            team=cls.team_a,
        )
        for key, name in (
            ("A", "Aynı isim"),
            ("B", "İkinci temsilci"),
            ("C", "Aynı isim"),
        ):
            Agent.objects.create(pk=key, name=name)
        for key in ("X", "Y"):
            Campaign.objects.create(pk=key, name=key)
        # B has past membership too; neither historical attribution nor row duplication is valid.
        AgentTeamAssignment.objects.create(
            agent_id="B",
            team_id="TB",
            valid_from=local("2026-01-01"),
            valid_to=local("2026-09-01"),
        )
        for agent, team in (("A", "TA"), ("B", "TA"), ("C", "TB")):
            AgentTeamAssignment.objects.create(
                agent_id=agent, team_id=team, valid_from=local("2026-09-01")
            )
        rater = Rater.objects.create(name="Değerlendirici")
        facts = [
            ("A1", "A", "X", "2026-10-01T00:00:00", 1, 100, "80"),
            ("A2", "A", "X", "2026-10-01T23:59:59", 3, None, "60"),
            ("A3", "A", "Y", "2026-10-02T10:30:00", 2, 0, None),
            ("B1", "B", "X", None, 1, 300, "90"),
            ("C1", "C", "X", "2026-10-01T11:00:00", 4, 15, "50"),
            ("U1", None, "X", "2026-10-01T11:00:00", 1, 200, "100"),
            ("N1", "A", "X", "2026-10-02T11:00:00", None, 40, None),
            ("N2", "A", "Y", "2026-10-02T11:00:00", 4, None, "0"),
        ]
        for key, agent, campaign, started, result, duration, quality in facts:
            call = Call.objects.create(
                pk=key,
                agent_id=agent,
                campaign_id=campaign,
                started_at=local(started) if started else None,
                result_id=result,
                duration_seconds=duration,
            )
            if quality is not None:
                QualityScore.objects.create(
                    call=call, rater=rater, total_score=Decimal(quality)
                )

    def report(self, user=None, **selection):
        return calculate_report(user or self.manager, ReportQuery(**selection))

    def test_denominators_and_missing_facts_are_independent(self):
        values = self.report()["summary"]
        self.assertEqual(values["totalCalls"], 8)
        self.assertEqual(values["reachedCalls"], 5)
        self.assertEqual(values["unreachableCalls"], 2)
        self.assertEqual(values["unknownResultCalls"], 1)
        self.assertEqual(values["reachRate"], 62.5)
        self.assertEqual(values["conversionRate"], 60)
        self.assertEqual(values["averageTalkSeconds"], 150)
        self.assertEqual(
            values["basis"],
            {
                "talkSecondsSum": 600,
                "talkDurationCount": 4,
                "qualityScoreSum": "380.00",
                "qualityScoreCount": 6,
            },
        )
        self.assertAlmostEqual(values["averageQualityScore"], 380 / 6)
        self.assertEqual(values["coverage"]["reachedWithoutDurationCalls"], 1)
        self.assertEqual(values["coverage"]["withoutUsableQualityCalls"], 2)

    def test_captain_filters_cannot_expand_scope(self):
        self.assertEqual(self.report(self.captain)["summary"]["totalCalls"], 6)
        for selection in ({"team_ids": ("TB",)}, {"agent_ids": ("C",)}):
            summary = self.report(self.captain, **selection)["summary"]
            self.assertEqual(summary["totalCalls"], 0)
            self.assertIsNone(summary["reachRate"])
            self.assertIsNone(summary["averageQualityScore"])

    def test_date_bounds_are_inclusive_local_calendar_days(self):
        result = self.report(
            date_from=date(2026, 10, 1), date_to=date(2026, 10, 1), group_by=("hour",)
        )
        self.assertEqual(result["summary"]["totalCalls"], 4)
        self.assertEqual(result["dateCoverage"]["undatedCallsExcluded"], 1)
        self.assertEqual(
            {
                row["dimensions"]["hour"]: row["metrics"]["totalCalls"]
                for row in result["breakdown"]["rows"]
            },
            {0: 1, 11: 2, 23: 1},
        )

    def test_current_team_and_combined_filters_do_not_fan_out_calls(self):
        result = self.report(group_by=("team",))
        self.assertEqual(result["summary"]["totalCalls"], 8)
        self.assertEqual(result["breakdown"]["excludedCalls"], 1)
        self.assertEqual(
            {
                row["dimensions"]["team"]["id"]: row["metrics"]["totalCalls"]
                for row in result["breakdown"]["rows"]
            },
            {"TA": 6, "TB": 1},
        )
        selected = self.report(
            team_ids=("TA",),
            campaign_ids=("X",),
            date_from=date(2026, 10, 1),
            date_to=date(2026, 10, 1),
        )
        self.assertEqual(selected["summary"]["totalCalls"], 2)

    def test_missing_group_keys_and_pagination_preserve_totals(self):
        grouped = self.report(group_by=("team", "day"), limit=1)["breakdown"]
        self.assertEqual(grouped["excludedCalls"], 2)
        self.assertEqual(grouped["totals"]["totalCalls"], 6)
        self.assertEqual(grouped["pagination"]["totalGroups"], 3)
        self.assertEqual(grouped["pagination"]["nextOffset"], 1)
        self.assertEqual(len(grouped["rows"]), 1)

    def test_identical_names_are_grouped_by_id_and_averages_use_base_sums(self):
        result = self.report(group_by=("agent",))
        rows = {
            row["dimensions"]["agent"]["id"]: row for row in result["breakdown"]["rows"]
        }
        self.assertEqual(set(rows), {"A", "B", "C"})
        self.assertEqual(
            rows["A"]["dimensions"]["agent"]["name"],
            rows["C"]["dimensions"]["agent"]["name"],
        )
        self.assertAlmostEqual(
            result["breakdown"]["totals"]["averageTalkSeconds"], 400 / 3
        )

    def test_zero_is_not_missing_and_empty_denominator_is_null(self):
        empty = self.report(campaign_ids=("MISSING",))["summary"]
        self.assertIsNone(empty["conversionRate"])
        unreachable = self.report(agent_ids=("C",))["summary"]
        self.assertEqual(unreachable["reachRate"], 0)
        self.assertIsNone(unreachable["averageTalkSeconds"])
        self.assertIsNone(unreachable["conversionRate"])
        self.assertEqual(unreachable["averageQualityScore"], 50)

    def test_fractional_quality_sum_preserves_hundredths(self):
        QualityScore.objects.filter(call_id="A1").update(total_score=Decimal("77.05"))
        self.assertEqual(self.report()["summary"]["basis"]["qualityScoreSum"], "377.05")

    def test_invalid_filters_fail_instead_of_silently_widening_the_report(self):
        for params in (
            "groupBy=agent,agent",
            "groupBy=rater",
            "dateFrom=2026-02-30",
            "dateFrom=2026-10-02&dateTo=2026-10-01",
            "dateTo=9999-12-31",
            "teamId=",
            "agentId=../../",
            "limit=1001",
            "offset=-1",
            "campaign=X",
            "dateFrom=2026-10-01&dateFrom=2026-10-02",
        ):
            with self.subTest(params=params), self.assertRaises(ApiError):
                parse_query(QueryDict(params))
        parsed = parse_query(
            QueryDict("teamId=TA&teamId=TB&teamId=TA&groupBy=team,day")
        )
        self.assertEqual(parsed.team_ids, ("TA", "TB"))
        self.assertEqual(parsed.group_by, ("team", "day"))

    def test_endpoint_requires_login_and_only_accepts_get(self):
        factory = RequestFactory()
        request = factory.get("/api/reports/kpis")
        request.user = AnonymousUser()
        self.assertEqual(kpis(request).status_code, 401)
        request = factory.post("/api/reports/kpis")
        request.user = self.manager
        self.assertEqual(kpis(request).status_code, 405)

    def test_revoked_account_is_rechecked_inside_report_snapshot(self):
        User.objects.filter(pk=self.manager.pk).update(
            auth_version=self.manager.auth_version + 1
        )
        with self.assertRaises(ApiError) as caught:
            self.report()
        self.assertEqual(caught.exception.code, "AUTH001")
