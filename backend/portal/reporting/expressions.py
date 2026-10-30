"""Group the stored Turkish wall clock without applying another timezone conversion."""

from django.db.models import Func, IntegerField


class StoredHour(Func):
    output_field = IntegerField()
    arity = 1
    template = "CAST(EXTRACT(HOUR FROM %(expressions)s) AS integer)"

    def as_sqlite(self, compiler, connection, **extra_context):
        expression, params = compiler.compile(self.source_expressions[0])
        return f"CAST(strftime('%%H', {expression}) AS integer)", params
