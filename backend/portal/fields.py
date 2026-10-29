"""Business timestamps are stored as Turkish wall time, without a database timezone."""

from zoneinfo import ZoneInfo
from django.db import models
from django.utils import timezone

BUSINESS_TIMEZONE = ZoneInfo("Europe/Istanbul")


class LocalDateTimeField(models.DateTimeField):
    """Keep Django's aware datetimes while persisting timestamp without time zone."""

    def db_type(self, connection):
        if connection.vendor == "postgresql":
            return "timestamp without time zone"
        return super().db_type(connection)

    def get_db_prep_value(self, value, connection, prepared=False):
        value = self.get_prep_value(value)
        if value is not None and timezone.is_aware(value):
            value = timezone.make_naive(value, BUSINESS_TIMEZONE)
        return connection.ops.adapt_datetimefield_value(value)

    def from_db_value(self, value, expression, connection):
        if value is not None and timezone.is_naive(value):
            return timezone.make_aware(value, BUSINESS_TIMEZONE)
        return value
