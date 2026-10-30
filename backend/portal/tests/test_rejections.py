"""Focused rejection boundary checks; all provider calls are mocked, all data is synthetic."""

from datetime import datetime
import json
from unittest.mock import patch
from django.http import QueryDict
from django.test import RequestFactory, SimpleTestCase, TestCase
from portal.fields import BUSINESS_TIMEZONE
from portal.http import ApiError
from portal.models import (
    Agent,
    AgentTeamAssignment,
    AnalysisRun,
    Call,
    Campaign,
    Team,
    Transcript,
    User,
)
from portal.rejection_analysis import service, views
from portal.rejection_analysis.provider import Classification, validate_output
from portal.rejection_analysis.taxonomy import digest
from portal.rejection_analysis.transcripts import conversation_turns
from portal.reporting.filters import parse_query


class ResponseValidationTests(SimpleTestCase):
    def test_accepts_ordered_categories_and_empty_result(self):
        self.assertEqual(
            validate_output(
                '{"dosya":"C1.txt","sebepler":["Fiyat","İlgilenmiyor"]}', "C1.txt"
            ),
            ("Fiyat", "İlgilenmiyor"),
        )
        self.assertEqual(
            validate_output('{"dosya":"C1.txt","sebepler":[]}', "C1.txt"), ()
        )

    def test_rejects_wrong_call_invented_duplicates_and_extra_fields(self):
        for value in (
            {"dosya": "OTHER.txt", "sebepler": ["Fiyat"]},
            {"dosya": "C1.txt", "sebepler": ["Başka"]},
            {"dosya": "C1.txt", "sebepler": ["Fiyat", "Fiyat"]},
            {"dosya": "C1.txt", "sebepler": ["Fiyat"], "confidence": 1},
            {"dosya": "C1.txt", "sebepler": ["Fiyat", "Gizlilik", "Düşünceli"]},
            {"dosya": "C1.txt", "sebepler": [{"unexpected": "object"}]},
        ):
            with self.subTest(value=value), self.assertRaises(ApiError):
                validate_output(json.dumps(value), "C1.txt")

    def test_speaker_parser_preserves_content_and_unknown_lines(self):
        turns = conversation_turns(
            "Kayıt başlangıcı\nTEMSİLCİ: Merhaba.\nDevam.\nMÜŞTERİ: Hayır.\nMÜŞTERİ: Teşekkürler."
        )
        self.assertEqual(
            [turn["speaker"] for turn in turns],
            ["unknown", "agent", "customer", "customer"],
        )
        self.assertEqual(turns[1]["content"], "Merhaba.\nDevam.")


@patch.dict(
    "os.environ", {"OPENAI_API_KEY": "test-placeholder", "OPENAI_MODEL": "gpt-6-luna"}
)
class RejectionScopeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = User.objects.create(
            email="manager@rejection.test", display_name="Manager", role_id="manager"
        )
        cls.team = Team.objects.create(pk="TA", name="A")
        other_team = Team.objects.create(pk="TB", name="B")
        cls.captain = User.objects.create(
            email="captain@rejection.test",
            display_name="Captain",
            role_id="captain",
            team=cls.team,
        )
        campaign = Campaign.objects.create(pk="X", name="Kampanya")
        for agent_id, team in (("A", cls.team), ("B", other_team)):
            agent = Agent.objects.create(pk=agent_id, name=f"Agent {agent_id}")
            AgentTeamAssignment.objects.create(
                agent=agent,
                team=team,
                valid_from=datetime(2020, 1, 1, tzinfo=BUSINESS_TIMEZONE),
            )
        for call_id, agent, started, result in (
            ("C1", "A", "2026-10-01T23:59:59", 2),
            ("C2", "B", "2026-10-02T00:00:00", 2),
            ("C3", "A", None, 2),
            ("C4", "A", "2026-10-01T10:00:00", 1),
        ):
            call = Call.objects.create(
                pk=call_id,
                agent_id=agent,
                campaign=campaign,
                result_id=result,
                started_at=(
                    datetime.fromisoformat(started).replace(tzinfo=BUSINESS_TIMEZONE)
                    if started
                    else None
                ),
            )
            content = "TEMSİLCİ: Merhaba.\nMÜŞTERİ: Çok pahalı."
            Transcript.objects.create(
                call=call, content=content, content_sha256=digest(content)
            )

    def request(self, call_id="C1", user=None, **filters):
        request = RequestFactory().post(
            "/api/rejections/analyze",
            data=json.dumps({"callId": call_id, **filters}),
            content_type="application/json",
        )
        request.user = user or self.manager
        return request

    def test_dates_include_entire_day_and_all_time_retains_unknown_dates(self):
        one_day = service.overview(
            self.manager,
            parse_query(QueryDict("dateFrom=2026-10-01&dateTo=2026-10-01")),
        )
        self.assertEqual([row["callId"] for row in one_day["records"]], ["C1"])
        all_time = service.overview(self.manager, parse_query(QueryDict()))
        self.assertEqual(
            {row["callId"] for row in all_time["records"]}, {"C1", "C2", "C3"}
        )

    def test_captain_cannot_read_other_team_or_run_analysis(self):
        result = service.overview(self.captain, parse_query(QueryDict()))
        self.assertEqual({row["callId"] for row in result["records"]}, {"C1", "C3"})
        with self.assertRaises(ApiError):
            service.detail(self.captain, parse_query(QueryDict()), "C2")
        with patch("portal.rejection_analysis.service.classify") as provider:
            self.assertEqual(
                views.analyze(self.request(user=self.captain)).status_code, 403
            )
            provider.assert_not_called()

    def test_call_outside_selected_dates_is_not_sent(self):
        with patch("portal.rejection_analysis.service.classify") as provider:
            response = views.analyze(
                self.request(dateFrom="2026-10-02", dateTo="2026-10-02")
            )
            self.assertEqual(response.status_code, 404)
            provider.assert_not_called()

    @patch("portal.rejection_analysis.service.classify")
    def test_success_is_saved_once_and_reused(self, provider):
        provider.return_value = Classification(
            ("Fiyat",), '{"dosya":"C1.txt","sebepler":["Fiyat"]}', 32, 12, 30
        )
        first = views.analyze(self.request())
        second = views.analyze(self.request())
        self.assertEqual(first.status_code, 200)
        self.assertTrue(json.loads(second.content)["cached"])
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(AnalysisRun.objects.count(), 1)
        saved = service.detail(self.manager, parse_query(QueryDict()), "C1")
        self.assertEqual(saved["categoryIds"], [5])
        self.assertTrue(saved["analyzed"])
        self.assertEqual(saved["turns"][1]["speaker"], "customer")

    @patch("portal.rejection_analysis.service.classify")
    def test_failure_does_not_create_a_success(self, provider):
        provider.side_effect = ApiError("LLM101", "Provider rejected key", 502)
        response = views.analyze(self.request())
        self.assertEqual(response.status_code, 502)
        run = AnalysisRun.objects.get()
        self.assertEqual(run.status, "failed")
        self.assertFalse(run.is_selected)
        self.assertFalse(run.labels.exists())

    @patch("portal.rejection_analysis.service.classify")
    def test_changed_transcript_invalidates_cached_classification(self, provider):
        provider.return_value = Classification(
            (), '{"dosya":"C1.txt","sebepler":[]}', 20, 10, 20
        )
        views.analyze(self.request())
        Transcript.objects.filter(pk="C1").update(
            content="MÜŞTERİ: Başka bir metin.",
            content_sha256=digest("MÜŞTERİ: Başka bir metin."),
        )
        saved = service.detail(self.manager, parse_query(QueryDict()), "C1")
        self.assertFalse(saved["analyzed"])
        views.analyze(self.request())
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(AnalysisRun.objects.filter(is_selected=True).count(), 1)

    def test_invalid_dates_fail_before_provider(self):
        response = views.analyze(
            self.request(dateFrom="2026-10-03", dateTo="2026-10-01")
        )
        self.assertEqual(response.status_code, 400)
