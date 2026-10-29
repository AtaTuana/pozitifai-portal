"""Create the first administrator locally; no anonymous HTTP registration exists."""

from getpass import getpass
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from portal.models import AuditEvent, User


class Command(BaseCommand):
    help = "İlk admin hesabını yerel terminalden oluşturur; varsa değiştirmez."

    def handle(self, **options):
        if User.objects.filter(role_id="admin").exists():
            return
        self.stdout.write(
            "İlk açılış: admin hesabını oluştur. Şifre yazarken ekranda görünmez."
        )
        try:
            name = input("Ad soyad: ").strip()
            email = input("E-posta: ").strip().lower()
            password = getpass("Şifre (en az 12 karakter): ")
            repeated = getpass("Şifre tekrar: ")
        except (EOFError, KeyboardInterrupt):
            raise CommandError(
                "SETUP001: Admin hesabı oluşturulmadı. start.bat ile tekrar başlat."
            )
        if not name or len(name) > 150 or password != repeated or len(password) > 128:
            raise CommandError(
                "SETUP002: Ad ve eşleşen şifreler gerekli; tekrar başlat."
            )
        user = User(email=email, display_name=name, role_id="admin")
        try:
            validate_email(email)
            validate_password(password, user)
        except ValidationError as exc:
            raise CommandError("SETUP002: " + " ".join(exc.messages))
        with transaction.atomic():
            if User.objects.filter(role_id="admin").exists():
                return
            user.set_password(password)
            user.save()
            AuditEvent.objects.create(
                actor=user, action="admin.created", target=str(user.pk)
            )
        self.stdout.write(self.style.SUCCESS("Admin hesabı hazır."))
