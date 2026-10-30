from django.urls import path
from portal import accounts, planning, imports, reports

urlpatterns = [
    path("api/session", accounts.session),
    path("api/login", accounts.sign_in),
    path("api/logout", accounts.sign_out),
    path("api/users", accounts.users),
    path("api/users/<int:user_id>", accounts.user_detail),
    path("api/profile", accounts.profile),
    path("api/password", accounts.change_password),
    path("api/planning", planning.planning),
    path("api/workspace", planning.workspace),
    path("api/reports/kpis", reports.kpis),
    path("api/activity", planning.activity),
    path("api/imports", imports.imports),
    path("api/imports/rules", imports.import_rules),
    path("api/imports/<int:batch_id>", imports.import_detail),
]
