"""Keep undated call facts and structured, versioned repair evidence."""

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
import portal.fields


class Migration(migrations.Migration):
    dependencies = [("portal", "0003_assignment_overlap_guards")]

    operations = [
        migrations.AlterField(
            model_name="call",
            name="started_at",
            field=portal.fields.LocalDateTimeField(
                blank=True, db_index=True, null=True
            ),
        ),
        migrations.AddField(
            model_name="importbatch",
            name="ruleset_version",
            field=models.CharField(default="1.0", max_length=16),
        ),
        migrations.AddField(
            model_name="importbatch",
            name="options",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="importbatch",
            name="summary",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="importrow",
            name="reference_id",
            field=models.CharField(blank=True, db_index=True, max_length=12),
        ),
        migrations.AddField(
            model_name="importrow",
            name="cleaned_data",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="importissue",
            name="rule_version",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="importissue",
            name="operation",
            field=models.CharField(default="review", max_length=24),
        ),
        migrations.AddField(
            model_name="importissue",
            name="before_value",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="importissue",
            name="after_value",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="importissue",
            name="evidence",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="importissue",
            name="report_effect",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="importissue",
            name="created_at",
            field=portal.fields.LocalDateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="importissue",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="import_actions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
