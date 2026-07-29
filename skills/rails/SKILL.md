---
name: rails
description: "Use when building or maintaining a Ruby on Rails app — models, controllers, views, routes and migrations; ActiveRecord associations, scopes and query performance; Hotwire (Turbo and Stimulus) UI; Active Job or Solid Queue background work; and Rails tests. Covers N+1 queries, migration safety on live tables, and flaky system tests around Turbo Frames. NOT plain Ruby scripts, gems or CLIs with no Rails loaded (that is `ruby`)."
tags: [rails, activerecord, hotwire, turbo, stimulus, solid-queue, minitest]
recommends: [ruby, postgresdb, testing-web, deployment, db-migrations]
profiles: []
origin: risco
---

# Build Rails the omakase way

Write Rails the way a core-adjacent senior would: fat-enough models, skinny
controllers, zero N+1, strong parameters, migrations that are reversible and safe on a
live table, and tests that exercise the request rather than the implementation. Lean
into the Rails 8 "omakase" defaults instead of fighting them — the framework already
made the boring choices for you.

This is **Rails the framework**: the MVC request cycle, ActiveRecord, Hotwire, Active
Job, the Rails test stack. The moment code stops loading Rails — a plain script, a gem,
an `Enumerable` refactor with no `ActiveRecord` in sight — it is no longer this skill.
That is `ruby` (see `../ruby/SKILL.md`).

## Target versions

```text
Rails        8.1   (stable line, released 2025-10-22; 8.0 shipped 2024-11-07)
Ruby         3.4+  (floor for current Rails)
Jobs/queue   Solid Queue   (default Active Job backend — database-backed, no Redis)
Cache        Solid Cache   (default cache store — database-backed)
WebSockets   Solid Cable   (default Action Cable adapter — database-backed)
Assets       Propshaft     (default; Sprockets is legacy)
JS           Importmaps    (default; no Node build step required)
Deploy       Kamal 2 + Thruster
Front-end    Hotwire = Turbo 8 + Stimulus
Auth         `rails generate authentication`  (built in; no Devise for basic auth)
```

A fresh Rails 8 app needs **no Redis and no Node**. Stop reaching for Sidekiq/Redis or
a JS bundler by reflex — the Solid trifecta and Importmaps already cover the default
case. Rails 8.1 adds Active Job Continuations (resumable long jobs), Structured Event
Reporting, local CI via `config/ci.rb`, and Markdown rendering.

## When to use

- Generating/editing anything under `app/` (models, controllers, views, jobs, mailers,
  channels), `config/routes.rb`, or `db/migrate/`.
- ActiveRecord work: associations, scopes, validations, callbacks, `includes`/`preload`/
  `eager_load`, query objects, migrations.
- Hotwire UI: Turbo Frames/Streams, morphing, Stimulus controllers, broadcasts.
- Background work via Active Job / Solid Queue; fragment caching via Solid Cache.
- Rails testing: Minitest model/integration/system tests, fixtures, RSpec + Capybara,
  debugging flaky Turbo system tests.
- Upgrading a Rails app or migrating off Redis/Sidekiq onto the Solid stack.

## When NOT to use

- Plain Ruby with no Rails loaded — scripts, gems, CLIs, Bundler packaging → `ruby`.
- PHP/Laravel → `laravel`. Python/Django → `django`. (Route by the language/framework
  the file actually uses.)
- Pure engine-level schema/index/locking depth not expressed as an AR migration →
  `postgresdb` / `mysql` / `db-migrations`.
- Host/container/CI provisioning (Kamal host setup, Docker, runners) → `deployment` /
  `docker` / `github-actions`. This skill writes the Rails-side glue, then hands off.

## The request cycle — where logic lives

Route → controller → model → view. Keep each layer doing one job.

- **Controllers stay skinny.** A controller action finds/builds objects, calls one
  domain method, and renders/redirects. Why: a controller fat with business rules is
  untestable except through the full HTTP stack and impossible to reuse.
- **Domain logic lives on the model.** Validations, scopes, state transitions, and
  computed attributes belong on the AR class. Why: that is where the data and its
  invariants already are.
- **Extract a PORO/service object only when** a method spans 2+ models or does external
  IO (payment, email, third-party API). Don't pre-extract — a one-model method is just
  a model method. Why: premature service objects scatter logic that AR would hold fine.

```ruby
# Good: skinny controller, domain logic on the model.
class PostsController < ApplicationController
  def create
    @post = Current.user.posts.build(post_params)
    if @post.publish   # model method owns the rule
      redirect_to @post, notice: "Published"
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def post_params
    params.expect(post: [:title, :body])   # Rails 8 strong params
  end
end
```

## ActiveRecord

Associations, validations, and scopes are the vocabulary — use them before writing raw
SQL or manual loops.

```ruby
class Post < ApplicationRecord
  belongs_to :author, class_name: "User"
  has_many :comments, dependent: :destroy

  validates :title, presence: true, length: { maximum: 120 }
  scope :published, -> { where.not(published_at: nil) }

  def publish
    update(published_at: Time.current)
  end
end
```

**Kill N+1 with eager loading.** The classic footgun is touching an association inside
a loop, firing one query per row.

```ruby
# Bad: 1 query for posts + 1 per post for its author (N+1).
Post.published.each { |p| puts p.author.name }

# Good: 2 queries total — posts, then all authors in one IN(...).
Post.published.includes(:author).each { |p| puts p.author.name }
```

Gate it: add the `bullet` gem in development, or mark a hot association
`strict_loading` so an accidental lazy load raises instead of silently degrading.

**Migrations must be reversible and safe on a live table.** A migration that locks a
large table blocks every reader and writer for its duration.

```ruby
# Good: a Postgres index built without an exclusive table lock.
class AddIndexToPostsOnAuthor < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!   # required — concurrent index can't run in a txn
  def change
    add_index :posts, :author_id, algorithm: :concurrently
  end
end
```

Rules: never `add_column ..., default:` on a huge legacy table without checking your
Rails/Postgres version handles it without a full rewrite; backfill data in batches with
`find_each` or `update_all`, not one giant `UPDATE` in the migration; add the
`strong_migrations` gem so unsafe operations fail in review, not in production.

Deeper AR — query objects, `strict_loading`, counter caches, composite primary keys,
advisory locks, per-operation safe-migration recipes (add column, rename, backfill in
batches) — is in `references/activerecord.md`.

## Hotwire

Hotwire is the default front-end: Turbo for navigation/updates, Stimulus for behavior.
Reach for the lightest tool that does the job.

| Need | Use | Why |
|------|-----|-----|
| Faster full-page navigation, no code | Turbo Drive (on by default) | Free; intercepts links/forms |
| Replace one bounded region after an action | Turbo **Frame** | Scoped DOM swap, no JS |
| Update several elements / push from server | Turbo **Stream** | Targeted append/replace/remove + broadcasts |
| Re-render a whole page and keep scroll/focus | **Morphing** (Turbo 8) | Diffs the DOM; kills most custom Stream choreography |
| Client behavior (toggle, copy, debounce) | Stimulus controller | Sprinkle, not a SPA |

Default to Turbo Drive and morphing; only hand-write a Turbo Stream when you need to
touch elements that morphing can't infer (e.g. prepend to a list from a broadcast).

```javascript
// app/javascript/controllers/clipboard_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["source"]
  static values = { successText: { type: String, default: "Copied!" } }

  copy() {
    navigator.clipboard.writeText(this.sourceTarget.value)
  }
}
```

Worked Frame/Stream/morph examples, model broadcasting (`broadcasts_to`), Stimulus
values/targets/outlets, and how to system-test Turbo are in `references/hotwire.md`.

## Background jobs & caching

Use Active Job over **Solid Queue** (the Rails 8 default). Two non-negotiable rules:

- **Jobs take serializable arguments — pass IDs, not records.** Why: a serialized AR
  object goes stale between enqueue and run; an ID is re-fetched fresh.
- **Jobs must be idempotent.** Why: retries and at-least-once delivery mean a job can
  run twice; design so the second run is a no-op.

```ruby
class CommentNotificationJob < ApplicationJob
  queue_as :default

  def perform(comment_id)
    comment = Comment.find_by(id: comment_id)
    return unless comment   # idempotent: nothing to do if it's gone
    CommentMailer.posted(comment).deliver_now
  end
end
```

For genuinely long work (large backfills, bulk exports) use **Active Job Continuations**
(Rails 8.1) so a job can checkpoint and resume instead of restarting from zero. Cache
expensive view fragments with the `cache` helper backed by Solid Cache:

```erb
<% cache @post do %>
  <%= render @post.comments %>
<% end %>
```

Do **not** add Sidekiq/Redis to a Rails 8 app unless a real, stated throughput or
latency requirement justifies the extra moving part. Solid Queue covers the default
case on the database you already run.

## Testing

Minitest + fixtures is the framework default; parallel execution is on by default.
RSpec-rails (8.x) is the popular alternative. Pick one and exercise behavior through the
request, never private methods.

| Test type | Base class | Tests |
|-----------|-----------|-------|
| Model / unit | `ActiveSupport::TestCase` | validations, scopes, domain methods |
| Integration | `ActionDispatch::IntegrationTest` | a request → response, status, redirects |
| System (browser) | `ApplicationSystemTestCase` | end-to-end UI incl. Turbo/Stimulus |
| Job | `ActiveJob::TestCase` | enqueue + `perform` behavior |

Fixtures (default) are fast and load once; reach for factories (FactoryBot) only when
per-test object variation gets unwieldy. **Flaky Turbo system test?** It's almost always
a timing race: never `sleep`. Use Capybara's auto-waiting matchers (`assert_selector`,
`assert_text`, `assert_no_selector`) which retry until the DOM settles, and swap the
default Selenium driver for **Cuprite or Playwright** to cut Turbo-timing flake.

Minitest vs RSpec layout, fixtures gotchas, driver config, parallelization, and
request-spec / broadcast-testing patterns are in `references/testing.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|--------------|--------------|------------|
| Business logic in the controller | Untestable except through HTTP; not reusable | Push it onto the model; service object only for cross-model/IO |
| Callback soup (`after_save` chains for business rules) | Hidden order-dependent side effects, brutal to test | Explicit method called from the action; reserve callbacks for data hygiene |
| Touching an association in a loop | N+1 — one query per row, silent in dev | `includes`/`preload`/`eager_load`; gate with `bullet`/`strict_loading` |
| Blocking DDL on a big live table | Locks readers + writers for the whole migration | `disable_ddl_transaction!` + `algorithm: :concurrently`; `strong_migrations` |
| Passing AR records into jobs | Stale serialized state; fails on retry | Pass IDs, re-`find` inside `perform` |
| Adding Sidekiq/Redis to a Rails 8 app by reflex | A new daemon + dependency for nothing | Solid Queue is the default; add Sidekiq only for a stated need |
| Queries or business logic in views | N+1 + logic you can't test | Prepare in controller/model; views only render |
| Testing private methods | Locks tests to internals; refactors break green tests | Test observable behavior through the request |
| Hand-rolled `fetch`/JS for live updates | Reinvents what Turbo gives free | Turbo Stream or morphing |

## Verify

Run `scripts/verify.sh` inside a Rails app for a read-only static gate: it runs RuboCop
(if rubocop-rails is configured) and `bin/rails zeitwerk:check`, and greps for the
statically-detectable anti-patterns above (Sidekiq/Redis in a default app, `.all.each`
mass loads, a concurrent `add_index` missing `disable_ddl_transaction!`). It skips any
check whose tooling is absent and exits non-zero only on a hard violation.
