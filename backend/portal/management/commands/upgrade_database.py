"""Apply pending migrations after creating a consistent local SQLite backup."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = "Bekleyen migration'ları uygular; mevcut SQLite veritabanını önce yedekler."

    def handle(self, **options):
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if not plan:
            self.stdout.write("Veritabanı güncel.")
            return
        if (
            connection.vendor == "sqlite"
            and "portal_user" in connection.introspection.table_names()
        ):
            database_path = Path(connection.settings_dict["NAME"]).resolve()
            backup_folder = database_path.parent / "backups"
            backup_folder.mkdir(parents=True, exist_ok=True)
            backup_path = (
                backup_folder
                / f"portal-before-migration-{datetime.now(timezone.utc):%Y%m%dT%H%M%S%fZ}.sqlite3"
            )
            try:
                with sqlite3.connect(
                    database_path.as_uri() + "?mode=ro", uri=True
                ) as source:
                    with sqlite3.connect(backup_path) as destination:
                        source.backup(destination)
                        if (
                            destination.execute("PRAGMA integrity_check").fetchone()[0]
                            != "ok"
                        ):
                            raise CommandError(
                                "DB007: Yedek bütünlük kontrolü başarısız; geçiş uygulanmadı."
                            )
            except sqlite3.Error as exc:
                raise CommandError(
                    "DB007: Veritabanı yedeklenemedi; disk alanını ve dosya erişimini kontrol edin."
                ) from exc
            self.stdout.write(f"Geçiş öncesi yedek: {backup_path}")
        call_command("migrate", interactive=False, verbosity=options["verbosity"])
