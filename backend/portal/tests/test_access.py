"""Boundary tests use real session/CSRF middleware and a separate temporary test database."""

import json
import time
from django.contrib.auth.hashers import identify_hasher
from django.test import Client, TestCase, override_settings
from portal.models import Agent, AuditEvent, Campaign, Team, TeamCampaign, User
from portal.planning import node_id
from portal.services.assignments import change_team

PASSWORD = "Test-only-password-29!"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = Team.objects.create(name="Alpha", id="A")
        cls.beta = Team.objects.create(name="Beta", id="B")
        cls.admin = User.objects.create_user(
            "admin@example.test", PASSWORD, display_name="Admin", role_id="admin"
        )
        cls.manager = User.objects.create_user(
            "manager@example.test", PASSWORD, display_name="Manager", role_id="manager"
        )
        cls.captain = User.objects.create_user(
            "captain@example.test",
            PASSWORD,
            display_name="Captain",
            role_id="captain",
            team=cls.alpha,
        )
        cls.campaign = Campaign.objects.create(name="Shared", id="SHARED")
        TeamCampaign.objects.create(team=cls.alpha, campaign=cls.campaign)
        TeamCampaign.objects.create(team=cls.beta, campaign=cls.campaign)
        cls.agent_a = Agent.objects.create(name="One", id="ONE")
        cls.agent_b = Agent.objects.create(name="Two", id="TWO")
        change_team(cls.agent_a.pk, cls.alpha.pk)
        change_team(cls.agent_b.pk, cls.beta.pk)

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.csrf = self.client.get("/api/session").json()["csrf"]

    def write(self, path, data, method="post", **headers):
        return getattr(self.client, method)(
            path,
            json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf,
            **headers,
        )

    def sign_in(self, user=None):
        response = self.write(
            "/api/login", {"email": (user or self.admin).email, "password": PASSWORD}
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.csrf = response.json()["csrf"]
        return response

    def draft(self):
        return self.client.get("/api/planning").json()

    def test_unauthenticated_data_is_rejected(self):
        for path in ("/api/planning", "/api/users", "/api/activity", "/api/profile"):
            self.assertEqual(self.client.get(path).status_code, 401)

    def test_login_requires_csrf_and_trusted_origin(self):
        data = {"email": self.admin.email, "password": PASSWORD}
        self.assertEqual(
            self.client.post(
                "/api/login", json.dumps(data), content_type="application/json"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.write(
                "/api/login", data, HTTP_ORIGIN="https://attacker.example"
            ).status_code,
            403,
        )

    def test_session_is_httponly_and_rotates_csrf(self):
        old = self.csrf
        response = self.sign_in()
        self.assertNotEqual(self.csrf, old)
        cookie = response.cookies["pozitifai_session"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Strict")
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_invalid_login_is_generic_and_rate_limited(self):
        for _ in range(10):
            response = self.write(
                "/api/login", {"email": "missing@example.test", "password": "wrong"}
            )
            self.assertEqual(response.status_code, 401)
        self.assertEqual(
            self.write(
                "/api/login", {"email": "missing@example.test", "password": "wrong"}
            ).status_code,
            429,
        )
        self.assertNotIn("wrong", str(list(AuditEvent.objects.values())))
        self.assertNotIn("missing@example.test", str(list(AuditEvent.objects.values())))

    def test_captain_cannot_discover_other_team_or_shared_campaign_edges(self):
        self.sign_in(self.captain)
        data = self.draft()
        ids = {node["id"] for node in data["nodes"]}
        self.assertIn(node_id("team", self.alpha.pk), ids)
        self.assertIn(node_id("agent", self.agent_a.pk), ids)
        self.assertNotIn(node_id("team", self.beta.pk), ids)
        self.assertNotIn(node_id("agent", self.agent_b.pk), ids)
        self.assertTrue(
            all(
                edge["source"] == node_id("team", self.alpha.pk)
                for edge in data["edges"]
            )
        )
        for path in ("/api/users", "/api/activity"):
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 403)

    def test_manager_reads_all_but_cannot_manage(self):
        self.sign_in(self.manager)
        data = self.draft()
        self.assertEqual(len(data["nodes"]), 5)
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 403)
        self.assertEqual(self.write("/api/users", {}).status_code, 403)
        self.assertTrue(
            self.client.get("/api/session").json()["user"]["capabilities"]["upload"]
        )

    def test_admin_creates_hashed_user_and_attribution(self):
        self.sign_in()
        response = self.write(
            "/api/users",
            {
                "name": "New captain",
                "email": "NEW@example.test",
                "role": "captain",
                "teamId": self.beta.pk,
                "password": "Some-Long-Test-Secret!",
                "currentPassword": PASSWORD,
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email="new@example.test")
        self.assertNotEqual(user.password, "Some-Long-Test-Secret!")
        self.assertTrue(user.check_password("Some-Long-Test-Secret!"))
        self.assertEqual(user.created_by, self.admin)
        self.assertNotIn("password", response.json()["user"])

    def test_only_one_admin_and_no_representative_login(self):
        self.sign_in()
        base = {
            "name": "Other",
            "email": "other@example.test",
            "password": PASSWORD,
            "currentPassword": PASSWORD,
        }
        self.assertEqual(
            self.write("/api/users", {**base, "role": "admin"}).status_code, 403
        )
        self.assertEqual(
            self.write("/api/users", {**base, "role": "agent"}).status_code, 400
        )
        self.assertEqual(
            self.write(
                f"/api/users/{self.admin.pk}", {**base, "role": "manager"}, "patch"
            ).status_code,
            403,
        )

    def test_role_update_revokes_existing_session(self):
        self.sign_in(self.captain)
        old_client = self.client
        self.client = Client(enforce_csrf_checks=True)
        self.csrf = self.client.get("/api/session").json()["csrf"]
        self.sign_in()
        response = self.write(
            f"/api/users/{self.captain.pk}",
            {
                "name": "Captain",
                "email": self.captain.email,
                "role": "manager",
                "currentPassword": PASSWORD,
            },
            "patch",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(old_client.get("/api/planning").status_code, 401)

    def test_admin_reauthentication_is_required(self):
        self.sign_in()
        response = self.write(
            "/api/users",
            {
                "name": "Nope",
                "email": "nope@example.test",
                "role": "manager",
                "password": PASSWORD,
                "currentPassword": "wrong",
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(User.objects.count(), 3)

    def test_profile_does_not_accept_role_injection(self):
        self.sign_in(self.captain)
        self.assertEqual(
            self.write(
                "/api/profile",
                {"name": "Changed", "role": "admin", "teamId": self.beta.pk},
                "patch",
            ).status_code,
            200,
        )
        self.captain.refresh_from_db()
        self.assertEqual(self.captain.role_id, "captain")
        self.assertEqual(self.captain.team_id, self.alpha.pk)

    def test_logout_revokes_session(self):
        self.sign_in()
        self.assertEqual(self.write("/api/logout", {}).status_code, 200)
        self.assertEqual(self.client.get("/api/planning").status_code, 401)

    def test_idle_session_expires(self):
        self.sign_in()
        session = self.client.session
        session["last_seen"] = int(time.time()) - 1801
        session.save()
        self.assertEqual(self.client.get("/api/planning").status_code, 401)

    def test_plan_saves_normalized_many_to_many_links(self):
        self.sign_in()
        data = self.draft()
        new_id = node_id("campaign", "NEW")
        data["nodes"].append(
            {"id": new_id, "kind": "campaign", "name": "New", "code": "NEW"}
        )
        data["edges"].extend(
            [
                {"source": node_id("team", team.pk), "target": new_id}
                for team in (self.alpha, self.beta)
            ]
        )
        response = self.write("/api/planning", data, "put")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Campaign.objects.get(pk="NEW").teams.count(), 2)
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 409)

    def test_invalid_agent_double_assignment_rolls_back(self):
        self.sign_in()
        data = self.draft()
        data["nodes"][0]["name"] = "Must not persist"
        data["edges"].append(
            {
                "source": node_id("team", self.beta.pk),
                "target": node_id("agent", self.agent_a.pk),
            }
        )
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 400)
        self.assertFalse(Team.objects.filter(name="Must not persist").exists())

    def test_unlink_preserves_records(self):
        self.sign_in()
        data = self.draft()
        data["edges"] = []
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 200)
        self.assertEqual(Agent.objects.count(), 2)
        self.assertEqual(Campaign.objects.count(), 1)
        self.assertFalse(
            Agent.objects.filter(
                team_assignments__valid_to__isnull=True, team_assignments__isnull=False
            ).exists()
        )

    def test_captains_team_cannot_be_archived(self):
        self.sign_in()
        data = self.draft()
        data["nodes"] = [
            node
            for node in data["nodes"]
            if node["id"] != node_id("team", self.alpha.pk)
        ]
        data["edges"] = [
            edge
            for edge in data["edges"]
            if edge["source"] != node_id("team", self.alpha.pk)
        ]
        self.assertEqual(self.write("/api/planning", data, "put").status_code, 400)
        self.alpha.refresh_from_db()
        self.assertTrue(self.alpha.is_active)

    def test_password_change_invalidates_session(self):
        self.sign_in()
        self.assertEqual(
            self.write(
                "/api/password",
                {"currentPassword": PASSWORD, "password": "Changed-Test-Password!"},
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/planning").status_code, 401)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("Changed-Test-Password!"))

    def test_default_password_hasher_is_not_test_hasher(self):
        with self.settings(
            PASSWORD_HASHERS=["django.contrib.auth.hashers.PBKDF2PasswordHasher"]
        ):
            user = User(email="hash@example.test")
            user.set_password(PASSWORD)
            self.assertEqual(identify_hasher(user.password).algorithm, "pbkdf2_sha256")
