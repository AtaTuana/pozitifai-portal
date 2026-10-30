"""Check a configured PostgreSQL connection before migrations, without exposing credentials."""

from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, connection


class Command(BaseCommand):
    help = "PostgreSQL baglantisini SELECT 1 ile kontrol eder; kayit degistirmez."

    def handle(self, **options):
        if connection.vendor != "postgresql":
            return
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone() != (1,):
                    raise DatabaseError()
        except DatabaseError:
            raise CommandError(
                "DB008: Neon baglantisi kurulamadi. Interneti, Neon durumunu ve "
                "baglanti bilgilerini kontrol edin. Ayarlari yeniden girmek icin "
                "start.bat --configure kullanin. Veritabani sifrenizi paylasmayin."
            ) from None
        self.stdout.write("PostgreSQL baglantisi hazir.")
