"""Frozen 0002 migration: rebuild the small foundation schema without losing its records."""

import hashlib
import re
from datetime import timezone as datetime_timezone
from zoneinfo import ZoneInfo
from django.core.management.color import no_style
from django.db import models
from django.db.migrations.operations.base import Operation
from django.db.migrations.exceptions import IrreversibleError
from django.utils import timezone

LOCAL_ZONE = ZoneInfo("Europe/Istanbul")


class NormalizePortalSchema(Operation):
    """UUID primary keys cannot be cast safely to integers; remap all related rows atomically."""

    reduces_to_sql = False
    reversible = False

    def __init__(self, operations):
        self.operations = operations

    def state_forwards(self, app_label, state):
        for operation in self.operations:
            operation.state_forwards(app_label, state)

    def describe(self):
        return "Preserve foundation data and apply normalized portal schema"

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        raise IrreversibleError(
            "DB004: Kimlik dönüşümü geri sarılmaz; geçiş öncesi veritabanı yedeğini geri yükleyin."
        )

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        connection = schema_editor.connection
        if connection.vendor not in ("sqlite", "postgresql"):
            raise RuntimeError(
                "DB001: Bu geçiş yalnızca SQLite ve PostgreSQL destekler."
            )
        alias = connection.alias
        old_models = list(
            from_state.apps.get_app_config(app_label).get_models(
                include_auto_created=True
            )
        )
        tables = {model._meta.db_table for model in old_models}
        all_tables = connection.introspection.table_names()
        # Refuse to drop a table referenced by an unexpected external application.
        with connection.cursor() as cursor:
            for table in set(all_tables) - tables:
                for constraint in connection.introspection.get_constraints(
                    cursor, table
                ).values():
                    foreign_key = constraint.get("foreign_key")
                    if foreign_key and foreign_key[0] in tables:
                        raise RuntimeError(
                            "DB003: Portal dışından gelen ilişki var; veri geçişi genişletilmeli."
                        )
        saved = {
            model._meta.model_name: list(model.objects.using(alias).values())
            for model in old_models
        }
        user_map = {
            str(row["id"]): index
            for index, row in enumerate(
                sorted(saved["user"], key=lambda row: str(row["id"])), start=1
            )
        }
        business_maps = {}
        for kind in ("team", "campaign", "agent"):
            mapping, used = {}, set()
            for row in sorted(saved[kind], key=lambda row: str(row["id"])):
                candidate = row["code"].upper()
                if not re.fullmatch(r"[A-Z0-9_-]{1,12}", candidate):
                    candidate = (
                        kind[0].upper()
                        + hashlib.sha256(str(row["id"]).encode())
                        .hexdigest()[:11]
                        .upper()
                    )
                if candidate in used:
                    raise RuntimeError(
                        "DB005: Yeni kayıt kimlikleri çakışıyor; kaynak kimlikleri inceleyin."
                    )
                mapping[str(row["id"])] = candidate
                used.add(candidate)
            business_maps[kind] = mapping

        def user_id(value):
            return user_map[str(value)] if value is not None else None

        def business_id(kind, value):
            return business_maps[kind][str(value)] if value is not None else None

        def previous_time(value):
            if value is None:
                return None
            # 0001 SQLite timestamps were UTC. New connection settings must not reinterpret them as local.
            if connection.vendor == "sqlite":
                value = value.replace(tzinfo=datetime_timezone.utc)
            elif timezone.is_naive(value):
                value = timezone.make_aware(value, datetime_timezone.utc)
            return value.astimezone(LOCAL_ZONE)

        converted = {}
        initial_memberships = []
        for old_model in old_models:
            name = old_model._meta.model_name
            converted[name] = []
            for old_row in saved[name]:
                row = dict(old_row)
                for field in old_model._meta.concrete_fields:
                    if isinstance(field, models.DateTimeField):
                        row[field.attname] = previous_time(row[field.attname])
                for field_name in ("created_by_id", "actor_id", "user_id"):
                    if field_name in row:
                        row[field_name] = user_id(row[field_name])
                if "team_id" in row:
                    row["team_id"] = business_id("team", row["team_id"])
                if "campaign_id" in row:
                    row["campaign_id"] = business_id("campaign", row["campaign_id"])
                if name in business_maps:
                    row["id"] = business_id(name, old_row["id"])
                    row.pop("code")
                if name == "agent":
                    team_id = row.pop("team_id")
                    row["start_date"] = None
                    if team_id is not None:
                        initial_memberships.append((row["id"], team_id))
                elif name == "user":
                    row["id"] = user_id(old_row["id"])
                    row["role_id"] = row.pop("role")
                    row["auth_version"] += 1
                elif name == "planningrevision":
                    row["version"] += 1
                converted[name].append(row)

        # Both supported engines provide transactional DDL. No intermediate schema can be committed.
        quote = connection.ops.quote_name
        if connection.vendor == "postgresql":
            schema_editor.execute(
                "DROP TABLE " + ", ".join(quote(table) for table in sorted(tables))
            )
        else:
            for table in sorted(tables):
                schema_editor.execute(f"DROP TABLE {quote(table)}")
        new_models = list(to_state.apps.get_app_config(app_label).get_models())
        for model in new_models:
            schema_editor.create_model(model)
        Role = to_state.apps.get_model(app_label, "Role")
        Role.objects.using(alias).bulk_create(
            [
                Role(id="admin", name="Admin"),
                Role(id="manager", name="Yönetici"),
                Role(id="captain", name="Takım kaptanı"),
            ]
        )
        Result = to_state.apps.get_model(app_label, "Result")
        Result.objects.using(alias).bulk_create(
            [
                Result(id=1, name="Satış", is_reached=True),
                Result(id=2, name="Ret", is_reached=True),
                Result(id=3, name="Geri ara", is_reached=True),
                Result(id=4, name="Ulaşılamadı", is_reached=False),
            ]
        )
        for name, rows in converted.items():
            model = to_state.apps.get_model(app_label, name)
            model.objects.using(alias).bulk_create([model(**row) for row in rows])
            # auto_now/auto_now_add must not rewrite historical timestamps during the copy.
            automatic = [
                field.attname
                for field in model._meta.concrete_fields
                if isinstance(field, models.DateTimeField)
                and (field.auto_now or field.auto_now_add)
            ]
            for row in rows:
                if automatic:
                    model.objects.using(alias).filter(
                        pk=row[model._meta.pk.attname]
                    ).update(**{key: row[key] for key in automatic})
            if model.objects.using(alias).count() != len(rows):
                raise RuntimeError(
                    "DB006: Geçişte kayıt sayısı uyuşmadı; tüm işlem geri alındı."
                )
        now = timezone.now()
        Assignment = to_state.apps.get_model(app_label, "AgentTeamAssignment")
        Assignment.objects.using(alias).bulk_create(
            [
                Assignment(agent_id=agent_id, team_id=team_id, valid_from=now)
                for agent_id, team_id in initial_memberships
            ]
        )
        # Existing data supplies no historical assignment dates. Begin only at the observed migration time.
        Audit = to_state.apps.get_model(app_label, "AuditEvent")
        migrated_users = to_state.apps.get_model(app_label, "User")
        for row in saved["user"]:
            if (
                migrated_users.objects.using(alias).get(pk=user_id(row["id"])).password
                != row["password"]
            ):
                raise RuntimeError(
                    "DB006: Parola özeti korunamadı; tüm işlem geri alındı."
                )
        all_new_models = list(
            to_state.apps.get_app_config(app_label).get_models(
                include_auto_created=True
            )
        )
        with connection.cursor() as cursor:
            for statement in connection.ops.sequence_reset_sql(
                no_style(), all_new_models
            ):
                cursor.execute(statement)
            if "django_session" in all_tables:
                cursor.execute("DELETE FROM django_session")
        Audit.objects.using(alias).create(
            action="database.normalized",
            target="0002",
            details={
                "user_ids": user_map,
                "business_ids": business_maps,
                "previous_codes": {
                    kind: {str(row["id"]): row["code"] for row in saved[kind]}
                    for kind in business_maps
                },
                "membership_baseline": "migration_time_only",
                "previous_counts": {name: len(rows) for name, rows in saved.items()},
            },
        )
