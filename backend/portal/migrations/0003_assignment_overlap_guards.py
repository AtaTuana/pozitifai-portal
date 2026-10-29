"""Reject overlapping membership intervals even when writes bypass the service layer."""

from django.db import migrations


def install_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        for event in ("INSERT", "UPDATE"):
            schema_editor.execute(f"""
                CREATE TRIGGER assignment_no_overlap_{event.lower()}
                BEFORE {event} ON portal_agentteamassignment
                WHEN EXISTS (
                    SELECT 1 FROM portal_agentteamassignment other
                    WHERE other.agent_id = NEW.agent_id AND other.id != NEW.id
                      AND (NEW.valid_to IS NULL OR other.valid_from < NEW.valid_to)
                      AND (other.valid_to IS NULL OR other.valid_to > NEW.valid_from)
                )
                BEGIN SELECT RAISE(ABORT, 'TEAM002: overlapping team assignments'); END
            """)
    elif schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("""
            CREATE FUNCTION portal_check_assignment_overlap() RETURNS trigger AS $$
            BEGIN
                PERFORM 1 FROM portal_agent WHERE id = NEW.agent_id FOR UPDATE;
                IF EXISTS (
                    SELECT 1 FROM portal_agentteamassignment other
                    WHERE other.agent_id = NEW.agent_id AND other.id != NEW.id
                      AND (NEW.valid_to IS NULL OR other.valid_from < NEW.valid_to)
                      AND (other.valid_to IS NULL OR other.valid_to > NEW.valid_from)
                ) THEN
                    RAISE EXCEPTION 'TEAM002: overlapping team assignments' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)
        schema_editor.execute(
            "CREATE TRIGGER assignment_no_overlap BEFORE INSERT OR UPDATE ON portal_agentteamassignment FOR EACH ROW EXECUTE FUNCTION portal_check_assignment_overlap()"
        )


def remove_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        for event in ("insert", "update"):
            schema_editor.execute(
                f"DROP TRIGGER IF EXISTS assignment_no_overlap_{event}"
            )
    elif schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(
            "DROP TRIGGER IF EXISTS assignment_no_overlap ON portal_agentteamassignment"
        )
        schema_editor.execute(
            "DROP FUNCTION IF EXISTS portal_check_assignment_overlap()"
        )


class Migration(migrations.Migration):
    dependencies = [("portal", "0002_normalized_reporting_schema")]
    operations = [migrations.RunPython(install_guards, remove_guards)]
