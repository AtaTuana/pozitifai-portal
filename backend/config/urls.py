from django.urls import path
from portal import accounts, planning, imports, reports
from portal.rejection_analysis import views as rejections

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
    path("api/reports/excel", reports.excel),
    path("api/rejections", rejections.overview),
    path("api/rejections/analyze", rejections.analyze),
    path("api/rejections/<str:call_id>", rejections.detail),
    path("api/activity", planning.activity),
    path("api/imports", imports.imports),
    path("api/imports/rules", imports.import_rules),
    path("api/imports/<int:batch_id>", imports.import_detail),
]
