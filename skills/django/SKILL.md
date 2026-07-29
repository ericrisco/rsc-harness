---
name: django
description: "Use when building, reviewing, securing, testing or shipping a Django app — models, migrations, QuerySets/managers, FBV/CBV views, forms, the admin, settings split, and Django REST Framework (serializers, ModelViewSet, permissions). NOT async FastAPI/Pydantic services (that is `fastapi`), NOT Postgres schema/index work (that is `postgresdb`)."
tags: [python, django, orm, drf, backend, web]
recommends: [postgresdb, secure-coding, deployment, testing-py, api-design]
origin: risco
---

# Django web applications

The single authoritative skill for building, reviewing, securing, testing and shipping a
**Django** app — the batteries-included, ORM-first, request/response Python framework.

Mental model: **a Django project is apps composed of fat-but-thin-enough models (domain +
query logic on the model/manager), views that orchestrate (FBV/CBV/DRF) and never own SQL,
an admin/forms layer, and a settings module split by environment.** The ORM, migrations,
auth, admin, CSP and the test runner are all first-party. Reach for the framework before you
add a dependency.

## Pinned stack (2026-06)

- **Django 5.2 LTS** — the production default. Released 2025-04-02, security fixes until
  ~April 2028, supports Python 3.10–3.14. New in 5.2: all models auto-imported in `shell`,
  `CompositePrimaryKey`, `BoundField` customization.
- **Django 6.0** — released 2025-12-03 (non-LTS, ~8 months until 6.1). Choose it only when you
  want the new built-in **Tasks framework** (background jobs without Celery) or **native CSP**
  (`ContentSecurityPolicyMiddleware`, `SECURE_CSP`) and can take the shorter support window.
  Drops Python 3.10/3.11; supports 3.12–3.14.
- **Django REST Framework 3.17.1** (2026-03-24) — adds Django 6.0 + Python 3.14 support.
- Python 3.12+, `pytest-django`, `factory_boy`. ruff/uv and type-hint policy live in `python`.

**Version rule:** default to 5.2 LTS. Pick 6.0 only for a concrete Tasks/CSP need, and say so.

## Route elsewhere

| Situation | Route to |
|---|---|
| Async service, `fastapi`/`pydantic`/uvicorn, async SQLAlchemy | `fastapi` |
| Postgres schema design, EXPLAIN ANALYZE, indexing strategy, RLS, pooling | `postgresdb` |
| Cross-stack OWASP/STRIDE threat modeling | `secure-coding` |
| Container/Compose/CI, gunicorn prod tuning, collectstatic pipeline | `deployment` |
| REST contract design (cursor vs offset, status codes, versioning) | `api-design` |
| ruff/uv/general type hints, packaging | `python` |

## Project shape

Split settings by environment; never ship one `settings.py` toggled by `DEBUG`.

```text
src/
  manage.py
  config/
    settings/
      base.py      # shared; reads secrets from os.environ
      dev.py       # from base import *; DEBUG=True; local hosts
      prod.py      # from base import *; DEBUG=False; SECURE_*; CSP
  catalog/         # an app = a bounded domain
    models.py  managers.py  views.py  serializers.py  urls.py  admin.py
    migrations/
    tests/
```

- Read secrets with `os.environ["SECRET_KEY"]` (or `django-environ`). **Never** commit a
  literal `SECRET_KEY` — a leaked key forges sessions and signed tokens.
- Select env via `DJANGO_SETTINGS_MODULE=config.settings.prod`, not an `if DEBUG` branch.
- One app = one domain. Resist a single `core` app that accretes everything.

## Models

Put domain and query logic on the model and its manager. The view stays thin.

```python
# managers.py
from django.db import models

class ArticleQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Article.Status.PUBLISHED)

    def for_reader(self):  # composes; reused everywhere, tested once
        return self.published().select_related("author")

# models.py
class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    tenant = models.ForeignKey("Tenant", on_delete=models.CASCADE)
    slug = models.SlugField()
    author = models.ForeignKey("Author", on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    objects = ArticleQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "slug"], name="uniq_tenant_slug"),
            models.CheckConstraint(
                check=models.Q(status="draft") | models.Q(published_at__isnull=False),
                name="published_needs_date",
            ),
        ]
        indexes = [models.Index(fields=["tenant", "status"])]
```

- **Constraints live in the DB, not just Python.** A `UniqueConstraint`/`CheckConstraint` is
  enforced under concurrency; a `clean()` check is not. Validate-in-Python-only is a foot-gun.
- `on_delete` is mandatory and load-bearing: `CASCADE` deletes children, `PROTECT` blocks the
  delete, `SET_NULL` orphans. Choosing wrong silently destroys data — pick deliberately.
- Multi-column PK (5.2+): `pk = models.CompositePrimaryKey("tenant_id", "id")`.
- Bad→Good for business logic:

```python
# Bad: logic in the view — untested, unreusable, duplicated across endpoints
def publish(request, pk):
    a = Article.objects.get(pk=pk)
    a.status = "published"; a.published_at = timezone.now(); a.save()

# Good: a method on the model — one place, testable, reused by view/admin/command
class Article(models.Model):
    def publish(self):
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.save(update_fields=["status", "published_at"])
```

## QuerySet performance

The N+1 is the single most common Django defect: one query for the list, then one more per row.

```python
# Bad: 1 + N queries — each .author touches the DB inside the loop
for a in Article.objects.all():
    print(a.author.name)

# Good: 2 queries total (FK -> JOIN; reverse/M2M -> second query)
for a in Article.objects.select_related("author").prefetch_related("tags"):
    print(a.author.name, [t.name for t in a.tags.all()])
```

| You are following | Use | Cost |
|---|---|---|
| Forward `ForeignKey` / `OneToOne` | `select_related(...)` | SQL JOIN, 1 query |
| Reverse FK, `ManyToMany` | `prefetch_related(...)` | 2nd query, joined in Python |
| Prefetch that itself needs filter/order | `Prefetch("x", queryset=...)` | controlled 2nd query |

- Need existence, not rows? `qs.exists()`, never `len(qs)` or `if qs.count()`.
- Need a few columns of a wide row? `.only("id", "slug")` / `.defer("body")`.
- Computed totals belong in the DB: `annotate(...)` / `aggregate(...)`, not a Python loop.
- Many inserts: `bulk_create(objs)` — one round-trip, not N `.save()` calls.
- Never `Model.objects.all()` then slice/filter in Python; push it into the QuerySet.

Deeper recipes (`assertNumQueries`, `Prefetch`, `.explain()`, ORM indexing) →
[references/orm-performance.md](references/orm-performance.md).

## Views & URLs

Keep views thin: validate input, call a model/manager method, return a response. No SQL.

| Need | Use |
|---|---|
| One bespoke action, custom flow | function-based view (FBV) |
| Standard list/detail/create/update/delete on a model | generic CBV (`ListView`, `DetailView`, …) |
| JSON API consumed by a client/SPA | drop to DRF (do **not** hand-roll `JsonResponse` CRUD) |

For the DRF surface — serializers, `ModelViewSet`, routers, permissions, throttling,
pagination, filtering, nested-serializer N+1, versioning — see
[references/drf.md](references/drf.md). The thin-view rule still holds: a fat serializer that
walks relations per row is just an N+1 wearing a tie.

## Migrations

```bash
python manage.py makemigrations catalog   # generate from model diff
python manage.py migrate                   # apply
python manage.py makemigrations --check    # CI gate: fail if a model drifts from migrations
```

- **Never edit a migration that has been applied anywhere.** Add a new one. Editing rewrites
  history and breaks every environment that already ran it.
- Data backfills go through `migrations.RunPython(forward, reverse)` with a reverse, not a
  one-off script. Use the historical model from `apps.get_model(...)`, not the imported class.
- Schema changes on a live table that you cannot afford to lock are expand-and-contract; the
  Postgres-side mechanics (lock modes, batching) live in `postgresdb`.

## Security

Set these in `prod.py`. Then prove it: `python manage.py check --deploy` must come back clean.

| Setting | Value | Why |
|---|---|---|
| `DEBUG` | `False` | `True` leaks settings + a stack-trace shell to the world |
| `ALLOWED_HOSTS` | explicit domains | `['*']` enables Host-header attacks |
| `SECRET_KEY` | from `os.environ` | a literal in source forges signed cookies/tokens |
| `SECURE_SSL_REDIRECT` | `True` | force HTTPS |
| `SECURE_HSTS_SECONDS` | `31536000` (+ include-subdomains, preload) | the `check --deploy` warning you saw is this being 0 |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | `True` | stop cookie leak over HTTP |
| `SECURE_CSP` (Django 6.0) | a real policy + nonce | native CSP; pre-6.0 use `django-csp` |

- CSRF protection is on by default — keep `CsrfViewMiddleware`; do not blanket-exempt views.
- The ORM parameterizes queries. Only `.raw()`, `.extra()` and `cursor.execute()` with an
  f-string/`%`-built string reopen SQL injection. Pass params, never interpolate.

Full `SECURE_*` checklist, CSP nonce/report-only, upload/SSRF, ORM-injection →
[references/security.md](references/security.md).

## Testing

```python
import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_owner_only(article, owner):
    client = APIClient()
    assert client.get(f"/api/articles/{article.pk}/").status_code == 403  # anon
    client.force_authenticate(owner)
    assert client.get(f"/api/articles/{article.pk}/").status_code == 200
```

- `pytest-django` + `@pytest.mark.django_db`; run with `--reuse-db` to skip rebuilds locally.
- `TestCase` wraps each test in a rolled-back transaction (fast). Use `TransactionTestCase`
  only when you test `on_commit` hooks or real commit behavior.
- Lock in N+1 fixes with `assertNumQueries(2)` — it fails the build when a relation regresses.
- Build instances with `factory_boy`, not 30 lines of `Model.objects.create(...)`.

Setup, fixtures, transactional DB, coverage → [references/testing.md](references/testing.md).

## Background work

| Need | Use |
|---|---|
| New project on Django 6.0, simple enqueue-and-forget jobs | the built-in **Tasks framework** |
| Pre-6.0, or you need schedules/retries/fan-out/result backends/workers at scale | **Celery** |

Either way: enqueue from the model/service layer, never block the request thread.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Business logic in the view | untested, duplicated across endpoints | method on the model/manager |
| f-string SQL into `.raw()`/`.extra()`/`cursor.execute` | SQL injection | parameterized queries |
| Looping rows touching `.author` | N+1 queries | `select_related`/`prefetch_related` |
| `DEBUG=True` in prod | leaks settings + stack traces | `DEBUG=False` in `prod.py` |
| `SECRET_KEY` literal in source | forged sessions/tokens | `os.environ` |
| Validation only in `clean()` | races under concurrency | DB `UniqueConstraint`/`CheckConstraint` |
| `Model.objects.all()` in a template loop | one query per iteration | prefetch in the view |
| `ModelViewSet` with no `permission_classes` | endpoint open to the world | explicit permission class |
| Fat serializer walking relations | N+1 per response | prefetch + `assertNumQueries` |
| Editing an applied migration | breaks every env that ran it | new migration |
| `len(qs)` / `qs.count()` to test existence | full fetch/COUNT | `qs.exists()` |
| Swallowing `Model.DoesNotExist` silently | hidden bugs | `get_object_or_404` or handle explicitly |

## Verify

`scripts/verify.sh [TARGET]` greps tracked Django source for high-signal foot-guns:
FAIL on a literal `SECRET_KEY`, `ALLOWED_HOSTS = ['*']`, or f-string SQL in
`.raw()`/`.extra()`/`cursor.execute`; WARN on `DEBUG = True` outside a dev settings file and
a `ModelViewSet`/`APIView` with no `permission_classes`. Read-only, exit 0 on a clean or empty
target. It is a lint, not a substitute for `manage.py check --deploy` or the test suite.
