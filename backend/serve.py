"""Small local WSGI service; Vite forwards same-origin /api requests here."""

import os
from waitress import serve
from config.wsgi import application

if __name__ == "__main__":
    serve(
        application,
        host="127.0.0.1",
        port=int(os.environ.get("API_PORT", "8000")),
        threads=4,
        max_request_body_size=262144,
        clear_untrusted_proxy_headers=True,
    )
