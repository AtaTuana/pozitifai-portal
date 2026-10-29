"""Portal accounts and their three fixed authorization roles."""

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone
from portal.fields import LocalDateTimeField


class Role(models.Model):
    id = models.CharField(max_length=12, primary_key=True)
    name = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(id__in=["admin", "manager", "captain"]),
                name="known_portal_role",
            )
        ]

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractUser):
    """Only admin, manager and captain accounts authenticate; agents are separate records."""

    id = models.AutoField(primary_key=True)
    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150)
    role = models.ForeignKey(Role, default="manager", on_delete=models.PROTECT)
    team = models.ForeignKey(
        "Team", null=True, blank=True, on_delete=models.PROTECT, related_name="captains"
    )
    created_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL
    )
    auth_version = models.PositiveIntegerField(default=1)
    date_joined = LocalDateTimeField(default=timezone.now)
    last_login = LocalDateTimeField(null=True, blank=True)
    updated_at = LocalDateTimeField(auto_now=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]
    objects = UserManager()

    def get_role_display(self):
        return self.role.name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role"], condition=Q(role="admin"), name="one_portal_admin"
            ),
            models.UniqueConstraint(Lower("email"), name="unique_user_email_casefold"),
            models.CheckConstraint(
                condition=Q(auth_version__gte=1), name="positive_auth_version"
            ),
            models.CheckConstraint(
                condition=Q(role="captain", team__isnull=False)
                | Q(role__in=["admin", "manager"], team__isnull=True),
                name="valid_user_scope",
            ),
        ]
