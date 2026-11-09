# Django security checklist

The baseline is `SecurityMiddleware` + the right `SECURE_*` settings, proven by
`python manage.py check --deploy`. Run that in CI; treat its warnings as failures.

## The must-set settings (prod.py)

```python
import os

DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]          # KeyError on boot beats a silent default
ALLOWED_HOSTS = ["example.com", "www.example.com"]

SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31_536_000               # 1 year; the check --deploy nag is this at 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # only behind a trusted proxy

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
CSRF_TRUSTED_ORIGINS = ["https://example.com"]
```

- `SECURE_HSTS_SECONDS` is the most common `check --deploy` warning: it defaults to 0. Set it,
  but only once you are sure every subdomain is HTTPS — HSTS is sticky in browsers.
- `SECURE_PROXY_SSL_HEADER` is safe **only** when a proxy you control sets the header; trusting
  a client-settable header lets attackers spoof HTTPS.

## CSP — native in Django 6.0

```python
# 6.0+: ContentSecurityPolicyMiddleware reads these
from django.utils.csp import CSP

SECURE_CSP = {
    "default-src": [CSP.SELF],
    "script-src": [CSP.SELF, CSP.NONCE],   # nonce per response, no 'unsafe-inline'
    "img-src": [CSP.SELF, "data:"],
}
# SECURE_CSP_REPORT_ONLY = {...}  # roll out in report-only first, then enforce
```

```html
<script nonce="{{ request.csp_nonce }}">/* trusted inline */</script>
```

- Add `django.middleware.csp.ContentSecurityPolicyMiddleware` to `MIDDLEWARE`.
- Pre-6.0: the third-party `django-csp` package provides the same shape.
- Roll out with `SECURE_CSP_REPORT_ONLY` first; flip to `SECURE_CSP` once reports are clean.

## CSRF & sessions

- Keep `CsrfViewMiddleware`. Never blanket `@csrf_exempt`; for a DRF JSON API, auth via token/
  session is the boundary, and DRF enforces CSRF for `SessionAuthentication`.
- Set `SESSION_COOKIE_SAMESITE = "Lax"` (or `"Strict"` for sensitive apps).

## ORM injection — the only way in

The ORM parameterizes everything. You can only reintroduce injection by hand:

```python
# Bad: f-string interpolation — injectable
User.objects.raw(f"SELECT * FROM users WHERE email = '{email}'")
cursor.execute("SELECT * FROM logs WHERE id = %s" % user_id)

# Good: parameters, never interpolation
User.objects.raw("SELECT * FROM users WHERE email = %s", [email])
cursor.execute("SELECT * FROM logs WHERE id = %s", [user_id])
```

Avoid `.extra()` (deprecated, injection-prone). Prefer the ORM or `Func`/`RawSQL` with params.

## File uploads & SSRF

- Validate uploaded content type and size; store outside the web root; never trust the filename.
- Any server-side fetch of a user-supplied URL is SSRF-prone — allowlist hosts, block internal
  ranges. Cross-stack SSRF/threat-modeling depth is `security-audit`.
