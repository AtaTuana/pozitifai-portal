"""Performance views must share KPI arithmetic without widening a captain's scope."""

from datetime import date, datetime
from django.contrib.auth.models import AnonymousUser
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
from portal.reporting import ReportQuery
from portal.reporting.agents import agent_performance
from portal.reports import agents


def local(value):
    return datetime.fromisoformat(value).replace(tzinfo=BUSINESS_TIMEZONE)


class AgentPerformanceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for code in ("TA", "TB"):
            Team.objects.create(pk=code, name=code)
        cls.manager = User.objects.create(
            email="manager@example.test", role_id="manager"
        )
        cls.captain = User.objects.create(
            email="captain@example.test", role_id="captain", team_id="TA"
        )
        for code in ("X", "Y"):
            Campaign.objects.create(pk=code, name=code)
        for code, team in (("A", "TA"), ("B", "TB"), ("ZERO", "TA")):
            Agent.objects.create(
                pk=code,
                name="Aynı Ad" if code != "ZERO" else "Boş Temsilci",
                start_date=date(2025, 1, 15),
            )
            AgentTeamAssignment.objects.create(
                agent_id=code, team_id=team, valid_from=local("2026-01-01")
            )
        AgentTeamAssignment.objects.create(
            agent_id="A",
            team_id="TB",
            valid_from=local("2025-01-01"),
            valid_to=local("2026-01-01"),
        )
        for key, agent, campaign, started, result, duration in (
            ("A1", "A", "X", "2026-10-01T00:00:00", 1, 100),
            ("A2", "A", "X", "2026-10-01T23:59:59", 2, None),
            ("A3", "A", "X", None, 1, 200),
            ("A4", "A", "Y", "2026-10-02T09:00:00", 4, 10),
            ("B1", "B", "X", "2026-10-01T12:00:00", 1, 90),
            ("U1", None, "X", "2026-10-01T12:00:00", 1, 70),
        ):
            Call.objects.create(
                pk=key,
                agent_id=agent,
                campaign_id=campaign,
                started_at=local(started) if started else None,
                result_id=result,
                duration_seconds=duration,
            )
        QualityScore.objects.create(
            call_id="A1",
            rater=Rater.objects.create(name="Analist"),
            total_score=0,
            greeting_score=0,
        )

    def test_roster_keeps_zero_calls_and_distinct_ids_and_start_dates(self):
        report = agent_performance(self.manager, ReportQuery())
        rows = {row["id"]: row for row in report["agents"]}
        self.assertEqual(set(rows), {"A", "B", "ZERO"})
        self.assertEqual(rows["A"]["startDate"], "2025-01-15")
        self.assertEqual(rows["A"]["team"]["id"], "TA")
        self.assertEqual(rows["A"]["metrics"]["totalCalls"], 4)
        self.assertEqual(rows["ZERO"]["metrics"]["totalCalls"], 0)
        self.assertIsNone(rows["ZERO"]["metrics"]["averageQualityScore"])
        self.assertEqual(report["summary"]["coverage"]["unknownAgentCalls"], 1)

    def test_period_and_all_time_keep_campaign_and_same_metric_denominators(self):
        report = agent_performance(
            self.manager,
            ReportQuery(
                campaign_ids=("X",),
                date_from=date(2026, 10, 1),
                date_to=date(2026, 10, 1),
            ),
            "A",
        )
        self.assertEqual(report["summary"]["totalCalls"], 2)
        self.assertEqual(report["summary"]["conversionRate"], 50)
        self.assertEqual(report["summary"]["averageTalkSeconds"], 100)
        self.assertEqual(report["summary"]["averageQualityScore"], 0)
        self.assertEqual(
            report["summary"]["qualityComponents"]["greeting"]["averageScore"], 0
        )
        self.assertEqual(report["allTime"]["totalCalls"], 3)
        self.assertEqual(report["allTime"]["salesCalls"], 2)
        self.assertEqual(report["undatedCallsExcluded"], 1)
        self.assertEqual([row["hour"] for row in report["hourly"]], [0, 23])

    def test_no_period_calls_still_has_lifetime_but_no_invented_metrics(self):
        report = agent_performance(
            self.manager, ReportQuery(date_from=date(2030, 2, 1)), "A"
        )
        self.assertEqual(report["summary"]["totalCalls"], 0)
        self.assertIsNone(report["summary"]["reachRate"])
        self.assertEqual(report["allTime"]["totalCalls"], 4)
        self.assertEqual(report["hourly"], [])

    def test_captain_cannot_expand_scope_with_team_or_direct_profile(self):
        report = agent_performance(self.captain, ReportQuery())
        self.assertEqual({row["id"] for row in report["agents"]}, {"A", "ZERO"})
        self.assertEqual(report["summary"]["totalCalls"], 4)
        self.assertEqual(
            agent_performance(self.captain, ReportQuery(team_ids=("TB",)))["agents"], []
        )
        for person in ("B", "MISSING"):
            with self.assertRaises(ApiError) as caught:
                agent_performance(self.captain, ReportQuery(), person)
            self.assertEqual(
                (caught.exception.code, caught.exception.status), ("RPT004", 404)
            )

    def test_changed_role_and_disabled_account_are_rechecked(self):
        User.objects.filter(pk=self.manager.pk).update(role_id="captain", team_id="TB")
        report = agent_performance(self.manager, ReportQuery())
        self.assertEqual({row["id"] for row in report["agents"]}, {"B"})
        User.objects.filter(pk=self.manager.pk).update(is_active=False)
        with self.assertRaises(ApiError):
            agent_performance(self.manager, ReportQuery())

    def test_endpoint_rejects_unauthenticated_and_invalid_queries(self):
        factory = RequestFactory()
        request = factory.get("/api/reports/agents")
        request.user = AnonymousUser()
        self.assertEqual(agents(request).status_code, 401)
        for query in (
            "?dateFrom=2026-10-05&dateTo=2026-10-01",
            "?groupBy=agent",
            "?agentId=B",
        ):
            request = factory.get("/api/reports/agents" + query)
            request.user = self.manager
            self.assertEqual(agents(request).status_code, 400)
        request = factory.get("/api/reports/agents")
        request.user = self.manager
        self.assertEqual(agents(request).status_code, 200)
