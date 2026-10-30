"""Small HTTP boundary; caller-provided IDs never bypass role or date scoping."""

from django.db import DatabaseError
from django.http import JsonResponse, QueryDict
from portal.http import ApiError, body, endpoint, text_value
from portal.reporting.filters import ID_PATTERN, parse_query
from . import service

FILTERS = {"dateFrom", "dateTo", "campaignId"}


def selection(params):
    if set(params) - FILTERS:
        raise ApiError("REJ006", "Desteklenmeyen analiz filtresi.")
    return parse_query(params)


def respond(operation):
    try:
        return JsonResponse(operation())
    except DatabaseError:
        raise ApiError(
            "REJ007",
            "Analiz kayıtlarına erişilemedi. Veritabanı bağlantısını kontrol et; tamamlanan sonuçlar yenileyince görünür.",
            503,
        ) from None


@endpoint(["GET"])
def overview(request):
    query = selection(request.GET)
    return respond(lambda: service.overview(request.user, query))


@endpoint(["GET"])
def detail(request, call_id):
    query = selection(request.GET)
    if not ID_PATTERN.fullmatch(call_id):
        raise ApiError("REJ001", "Geçerli bir çağrı seç.", 404)
    return respond(lambda: service.detail(request.user, query, call_id))


@endpoint(["POST"])
def analyze(request):
    data = body(request)
    if set(data) - (FILTERS | {"callId"}):
        raise ApiError("REJ006", "Desteklenmeyen analiz parametresi.")
    call_id = text_value(data, "callId", 12)
    if not ID_PATTERN.fullmatch(call_id):
        raise ApiError("REJ001", "Geçerli bir çağrı seç.")
    params = QueryDict(mutable=True)
    for name in FILTERS & set(data):
        params[name] = text_value(data, name, 12)
    query = selection(params)
    return respond(lambda: service.analyze(request, query, call_id))
