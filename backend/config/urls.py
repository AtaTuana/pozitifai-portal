from django.urls import path
from portal import accounts, planning

urlpatterns = [
    path("api/session", accounts.session),
    path("api/login", accounts.sign_in),
    path("api/logout", accounts.sign_out),
    path("api/users", accounts.users),
    path("api/users/<uuid:user_id>", accounts.user_detail),
    path("api/profile", accounts.profile),
    path("api/password", accounts.change_password),
    path("api/planning", planning.planning),
    path("api/activity", planning.activity),
]
