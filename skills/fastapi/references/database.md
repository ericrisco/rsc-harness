# Async SQLAlchemy 2.0 + Alembic

The async persistence layer for a FastAPI service on SQLAlchemy 2.0, asyncpg 0.30 (or
psycopg 3 async), Alembic 1.13+, and PostgreSQL 16. The rules that prevent the two failures that
sink async ORM code: **one session per request with explicit commit/rollback**, and **never lazy-load
a relationship in async** — eager-load everything you serialize.

## Engine & session factory

```python
from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    # Built on first use, never at import time: tests and Alembic import this module freely.
    return create_async_engine(
        str(get_settings().database_url),
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=1800,
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

`expire_on_commit=False` is mandatory: with the default `True`, attributes expire after commit
and the *next* access triggers a lazy reload — which in async raises `MissingGreenlet`. The
`get_db` dependency owns the transaction lifecycle; services call `flush`, never `commit`.

## Declarative models (2.0 style)

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    full_name: Mapped[str]
    hashed_password: Mapped[str]
    is_active: Mapped[bool] = mapped_column(default=True)
```

`Mapped[...]` drives both the Python type and (where unambiguous) the column type. A bare
`Mapped[str]` is `NOT NULL`; `Mapped[str | None]` is nullable. `server_default=func.now()` puts
the default in the database (resilient to non-ORM writes); `onupdate` fires on ORM updates.

## Relationships

```python
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount_cents: Mapped[int]

    user: Mapped["User"] = relationship(back_populates="orders")


# On the User model:
#   orders: Mapped[list["Order"]] = relationship(
#       back_populates="user", cascade="all, delete-orphan"
#   )
```

`back_populates` keeps both sides in sync in the identity map. `cascade="all, delete-orphan"`
deletes orphaned children when removed from the collection; pair it with a DB-level
`ondelete="CASCADE"` on the FK so deletes are correct even outside the ORM.

## Querying

```python
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def queries(db: AsyncSession, pk: UUID, email: str) -> None:
    # Filtered, ordered, paginated SELECT -> list of model instances.
    result = await db.execute(
        select(User).where(User.is_active.is_(True)).order_by(User.created_at.desc()).limit(50)
    )
    users: list[User] = list(result.scalars().all())

    # Single row or None (raises on >1):
    one = await db.execute(select(User).where(User.email == email))
    maybe_user: User | None = one.scalar_one_or_none()

    # Fast identity-map lookup by primary key:
    by_pk: User | None = await db.get(User, pk)

    # Core UPDATE / DELETE with RETURNING (no round-trip to reload):
    updated = await db.execute(
        update(User).where(User.id == pk).values(is_active=False).returning(User.id)
    )
    _changed_id = updated.scalar_one_or_none()
    await db.execute(delete(User).where(User.id == pk))

    # Aggregate:
    total = await db.execute(select(func.count()).select_from(User))
    _count: int = total.scalar_one()
```

Use `.scalars()` to unwrap single-entity rows into model instances; without it you get `Row`
tuples. `scalar_one_or_none()` is the safe "fetch by unique key" idiom; `db.get` is the only one
that consults the identity map first and can skip a query entirely.

## N+1 & eager loading

**Lazy loading is unsafe in async SQLAlchemy.** Accessing an unloaded relationship outside an
awaited load triggers implicit I/O on the event loop and raises
`sqlalchemy.exc.MissingGreenlet` (or, if it ever succeeds, fires one query per parent row — the
N+1). Load relationships explicitly.

```python
# Bad: lazy access in async -> MissingGreenlet, or N+1 if it slips through.
async def bad(db: AsyncSession) -> list[int]:
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [len(u.orders) for u in users]  # u.orders was never loaded -> raises / N queries
```

```python
from sqlalchemy.orm import joinedload, selectinload


# Good: eager-load up front in one extra query (collections) / one join (scalars).
async def good_collections(db: AsyncSession) -> list[int]:
    result = await db.execute(select(User).options(selectinload(User.orders)))
    users = result.scalars().unique().all()
    return [len(u.orders) for u in users]


async def good_scalar(db: AsyncSession) -> list[str]:
    result = await db.execute(select(Order).options(joinedload(Order.user)))
    orders = result.scalars().all()
    return [o.user.full_name for o in orders]
```

Choose `selectinload` for collections (one follow-up `IN (...)` query, no row multiplication);
choose `joinedload` for scalar many-to-one (a single `JOIN`, no extra round-trip). Call
`.unique()` when a `joinedload` on a collection would otherwise duplicate parent rows.

## Repository / CRUD layer

Keep `select`/`flush` out of routers behind a generic repository so persistence is swappable
and testable in isolation.

```python
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    def __init__(self, model: type[ModelT], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get(self, pk: UUID) -> ModelT | None:
        return await self.db.get(self.model, pk)

    async def list(self, limit: int, offset: int) -> list[ModelT]:
        result = await self.db.execute(select(self.model).limit(limit).offset(offset))
        return list(result.scalars().all())

    async def add(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.db.delete(obj)
        await self.db.flush()
```

`flush` pushes pending SQL (assigning generated PKs / surfacing constraint errors) **without**
committing — the request's `get_db` owns the outer commit. Services compose repositories and
enforce business rules; routers call services.

## Transactions

```python
from sqlalchemy.ext.asyncio import AsyncSession


async def transfer(db: AsyncSession, debit_id, credit_id, cents: int) -> None:
    # Multi-statement atomicity: both updates commit together or neither does.
    async with db.begin():
        await debit(db, debit_id, cents)
        await credit(db, credit_id, cents)


async def with_savepoint(db: AsyncSession) -> None:
    # Nested SAVEPOINT: roll back a sub-step without aborting the whole transaction.
    async with db.begin_nested():
        await risky_step(db)
```

With the `get_db` commit-on-success pattern, prefer `flush` inside services and let the
dependency own the single outer commit. Reach for `db.begin()` explicitly only when a service
must guarantee atomicity across statements it would otherwise leave to the request boundary.

## Alembic (async)

Async migrations need an `env.py` that runs the engine inside an event loop and dispatches DDL
via `run_sync`.

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.db.base import Base

config = context.config
config.set_main_option("sqlalchemy.url", str(get_settings().database_url))
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


run_migrations_online()
```

```ini
# alembic.ini (sqlalchemy.url is overridden from env in env.py; leave a placeholder here)
[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/dbname
```

```bash
alembic revision --autogenerate -m "create users"
alembic upgrade head
```

Autogenerate is a draft, not an oracle: it misses server defaults, CHECK constraints, some type
changes, and table/column renames (it sees a drop + add). **Always read the generated migration**
before committing, and add `compare_type=True` (above) to catch column type drift. For a
review-then-apply workflow in prod, emit offline SQL with `alembic upgrade head --sql`.

## Connection pooling & production

Total open connections is bounded by `workers × (pool_size + max_overflow)` and must stay under
Postgres `max_connections` (default 100) with headroom for admin and other clients. With 5
gunicorn workers and the engine above (`10 + 20`), that is up to 150 connections — already over
the default. Either shrink the pool, raise `max_connections`, or front the DB with pgbouncer.

```python
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

# Behind pgbouncer in transaction-pooling mode: SQLAlchemy must not pool, and asyncpg's
# prepared-statement cache breaks because statements outlive the server-side session.
engine = create_async_engine(
    "postgresql+asyncpg://user:pass@pgbouncer:6432/app",
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "server_settings": {"statement_timeout": "5000"},  # ms; kill runaway queries
    },
)
```

`pool_pre_ping=True` issues a cheap liveness check before handing out a connection, transparently
replacing ones the DB or a load balancer dropped. `pool_recycle=1800` proactively closes
connections older than 30 minutes to dodge idle-timeout resets. A `statement_timeout` is the
backstop that stops one slow query from holding a connection forever.

## See Also

- [`production.md`](production.md) — worker/pool math, health checks, graceful shutdown.
- [`postgresdb`](../../postgresdb/SKILL.md) — engine-level schema/index design, EXPLAIN, expand-contract migrations, PgBouncer pooling beneath this async layer.
