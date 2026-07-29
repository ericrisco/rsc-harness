---
name: ruby
description: "Use when writing or refactoring plain Ruby outside Rails — scripts, CLIs, gems, libraries: Enumerable chains and blocks, module mixins and value objects, Bundler/gemspec packaging, whether metaprogramming earns its keep, Minitest or RSpec, Ruby 3.4/4.0 frozen-string hygiene. NOT Rails, ActiveRecord, or ActiveSupport idioms (that is `rails`)."
tags: [ruby, gems, bundler, metaprogramming, rspec, minitest, enumerable]
recommends: [rails, testing-web, secure-coding]
profiles: []
origin: risco
---

# Idiomatic Ruby, the language

Write Ruby a senior Rubyist would sign off on: expression-oriented, block-driven,
leaning on `Enumerable` and `Comparable` instead of hand-rolled loops, with
`frozen_string_literal` hygiene and a real `Gemfile`/`.gemspec` when you package.

This is **Ruby the language and its non-Rails ecosystem** — blocks, modules, gems,
metaprogramming, Minitest/RSpec. Delegate: Rails apps, ActiveRecord models, controllers,
migrations, views, Hotwire — anything that loads Rails or uses ActiveSupport/ActiveRecord
idioms — to [`rails`](../rails/SKILL.md); the same task in another language to
[`python`](../python/SKILL.md), [`go`](../go/SKILL.md), [`rust`](../rust/SKILL.md),
[`elixir`](../elixir/SKILL.md), [`php`](../php/SKILL.md) or
[`typescript`](../typescript/SKILL.md); the CI pipeline that runs your Ruby tests to
[`github-actions`](../github-actions/SKILL.md) — this skill writes the tests, not the workflow.

Targets **Ruby 4.0** (released 2025-12-25) on **3.4** semantics: Prism is the default
parser, string literals warn on mutation without a magic comment, `it` is an implicit
block param, and `Set` is now a core class.

## Mental model

Internalize these before writing a line:

1. **Everything is an expression and returns a value.** `if`, `case`, blocks, method
   bodies all yield a value — name and return it instead of threading a flag.
2. **Everything is an object receiving messages.** `5.times`, `nil.to_a`, `"x".freeze`.
   There are no primitives to special-case.
3. **Reach for `Enumerable` before you write a loop.** A manual index loop in Ruby is
   almost always a `map`/`select`/`reduce` you have not spotted yet.
4. **Prefer returning new values to mutating in place.** Mutation is allowed but it is
   the exception you justify, not the default.
5. **Freeze your string literals.** New files start with `# frozen_string_literal: true`.
6. **Dynamism is the trap, not the feature.** Metaprogramming is a scalpel; if a plain
   method, a `Struct`, or a `Data` does the job, use that.

## Blocks, procs, lambdas, yield

Blocks are the spine of Ruby. A method takes a block implicitly via `yield`, or
explicitly with `&block` when it must store or forward it.

```ruby
# frozen_string_literal: true

# Implicit: yield runs the caller's block and returns its value.
def with_timing
  start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  result = yield
  [result, Process.clock_gettime(Process::CLOCK_MONOTONIC) - start]
end

# Explicit: capture the block as a Proc to forward or store it.
def retrying(times, &block)
  attempts = 0
  begin
    block.call
  rescue StandardError
    (attempts += 1) < times ? retry : raise
  end
end
```

`proc` vs `lambda` differ in two ways that bite:

| Aspect | `proc` / block | `lambda` / `->` |
|--------|----------------|-----------------|
| Arity  | Lenient — extra args dropped, missing become `nil` | Strict — wrong count raises `ArgumentError` |
| `return` | Returns from the enclosing method (can surprise) | Returns from the lambda only |

Rule: use a **lambda** for a function-like value you call yourself; use a **block/proc**
for the "do this with each element" pattern. For cheap accumulation prefer
`each_with_object` (returns the seed) or `reduce`; use `tap` (returns the receiver) for
side effects and `then` for piping a value through a transform.

```ruby
# Bad: index loop building a result by mutation.
result = []
(0...items.length).each { |i| result << items[i].upcase if items[i].size > 3 }

# Good: intent reads top-to-bottom, no index, no pre-seeded array.
result = items.select { |s| s.size > 3 }.map(&:upcase)
```

## Enumerable & Comparable

Most loops map to one named method. Pick by **intent**, not by habit:

| You want to…                          | Use                          |
|---------------------------------------|------------------------------|
| Transform every element               | `map`                        |
| Keep / drop by predicate              | `select` / `reject`          |
| Fold into one value                   | `reduce` / `sum` / `min_by`  |
| Build a Hash or accumulate into a seed| `each_with_object`           |
| Count occurrences                     | `tally`                      |
| Bucket by a key                       | `group_by`                   |
| First match                           | `find` (`detect`)            |
| Pair index with element               | `each_with_index`            |

Make your own classes first-class collections by including `Enumerable` and defining
`each`; get `<`, `>`, `between?`, `clamp`, `sort` for free by including `Comparable` and
defining `<=>`.

```ruby
# frozen_string_literal: true

class Playlist
  include Enumerable

  def initialize(tracks) = @tracks = tracks
  def each(&) = @tracks.each(&)   # one method unlocks map/select/sort/...
end

class Version
  include Comparable
  attr_reader :major, :minor

  def initialize(major, minor)
    @major = major
    @minor = minor
  end

  def <=>(other) = [major, minor] <=> [other.major, other.minor]
end
```

## Modules & composition

Ruby favors composition through mixins over deep inheritance.

- `include M` — adds `M`'s instance methods to instances (the default mixin).
- `prepend M` — inserts `M` *before* the class in the lookup chain, so `M`'s methods can
  wrap the originals via `super` (cleaner than aliasing for decoration).
- `extend M` — adds `M`'s methods as *class/singleton* methods.

Rule: reach for a **module mixin** when the same behavior is shared across unrelated
classes; reserve inheritance for a genuine is-a hierarchy. Namespace with `module Foo`
to avoid global constant clashes. Need to patch a class without polluting it globally?
Use a **refinement** (`refine … using`) — a scoped, reversible scalpel — never a bare
monkey-patch. Full refinement scoping and `prepend`-wrapping in
[references/metaprogramming.md](references/metaprogramming.md).

## Value objects: Data vs Struct

```ruby
# frozen_string_literal: true

Point  = Data.define(:x, :y)         # immutable value object (Ruby 3.2+)
origin = Point.new(x: 0, y: 0)       # no setters; with(x: 1) returns a copy

Cursor = Struct.new(:x, :y)          # mutable; has setters and is Enumerable
```

| Need                                       | Reach for     |
|--------------------------------------------|---------------|
| Immutable value with equality + `with`     | `Data.define` |
| Mutable record, or array/positional access | `Struct.new`  |

Default to `Data` for value semantics; pick `Struct` only when you genuinely need
mutation or positional/`to_a` behavior.

## Metaprogramming, sparingly

Decision rule, in order: **could a plain method, a `Struct`, or a `Data` do this?**
If yes, do that. Only when the method *names themselves* are dynamic (driven by data or
config) does metaprogramming earn its keep.

- Prefer `define_method` (defines real, introspectable methods) over `method_missing`
  (intercepts at call time, slower, invisible to `respond_to?` and tooling).
- If you *must* use `method_missing`, you **must** also define `respond_to_missing?` —
  otherwise `respond_to?`, `method`, and duck-typing all lie about your object.
- Never `eval` a string built from user input.

```ruby
# Good: dynamic method names, but real methods that introspect and document themselves.
class Config
  def initialize(**data) = @data = data

  %i[host port timeout].each do |key|
    define_method(key)       { @data[key] }
    define_method("#{key}=") { |value| @data[key] = value }
  end
end
```

Building a real DSL, `instance_eval`/`class_eval`, and the full
`method_missing` + `respond_to_missing?` pairing live in
[references/metaprogramming.md](references/metaprogramming.md).

## Gems & Bundler

Bundler is the universal dependency manager. `bundle init` creates a `Gemfile`;
`bundle install` resolves and writes `Gemfile.lock`; run project binaries with
`bundle exec` so they use the locked versions.

- Use the **pessimistic constraint** `~> 2.3` (allows `2.x >= 2.3`, blocks `3.0`) for
  libraries; pin tighter only when forced.
- **Commit `Gemfile.lock` for applications** (reproducible installs); for a *library*
  gem, do not commit the lock — let consumers resolve.
- Scaffold a gem with `bundle gem NAME`, which generates the `lib/`, `test/`/`spec/`,
  `.gemspec`, and Rakefile layout.

```ruby
# my_gem.gemspec
Gem::Specification.new do |spec|
  spec.name        = "my_gem"
  spec.version     = MyGem::VERSION       # SemVer: MAJOR.MINOR.PATCH
  spec.summary     = "One-line description."
  spec.authors     = ["You"]
  spec.files       = Dir["lib/**/*.rb"]
  spec.required_ruby_version = ">= 3.4"
  spec.add_dependency "thor", "~> 1.3"
end
```

Full `bundle gem` tree, publishing flow (`gem build` / `gem push`), and Rake test tasks
are in [references/gems-and-testing.md](references/gems-and-testing.md).

## Ruby 4.0 / 3.4 hygiene

```ruby
# frozen_string_literal: true     # without it, 3.4+ warns under -W:deprecated on mutation

nums.map { it * 2 }               # `it` is the implicit single block param (3.4+)
seen = Set.new([1, 2, 3])         # Set is a core class in 4.0 — no `require "set"`
```

- The magic comment freezes every string literal in the file; mutating one then raises
  `FrozenError`. This is the cause of most "my string froze after upgrading" reports.
- `it` reads cleaner than `_1` for one-arg blocks.
- Ruby 4.0 ships **ZJIT** (a new JIT written in Rust, successor to YJIT) and removed
  `Ractor.yield`/`Ractor#take` in favor of `Ractor::Port`.

## Testing

Both ship a clean path; choose by ceremony tolerance:

| Framework | Pick when… |
|-----------|-----------|
| **Minitest** | You want the default — ships with Ruby, tiny surface, `assert`-style or spec-style, fast. |
| **RSpec** | You want the expressive DSL and large ecosystem (`describe`/`context`/`it`/`expect`, `let`, mocks). |

```ruby
# test/tally_test.rb  (Minitest)
require "minitest/autorun"
require "tally"

class TallyTest < Minitest::Test
  def test_counts_words
    assert_equal({ "a" => 2, "b" => 1 }, Tally.count("a b a"))
  end
end
```

```ruby
# spec/tally_spec.rb  (RSpec)
RSpec.describe Tally do
  subject(:counts) { described_class.count("a b a") }
  it { is_expected.to eq("a" => 2, "b" => 1) }
end
```

Run via `bundle exec rake test` (Minitest) or `bundle exec rspec` (RSpec). Fuller
examples with `let`/`subject`/`context` are in
[references/gems-and-testing.md](references/gems-and-testing.md).

## Linting & typing (optional layers)

- **Linter:** Standard (zero-config, "no bikeshadding" wrapper) when you want one less
  argument; RuboCop (`.rubocop.yml`, every cop opt-in/out) when the team wants control.
- **Types:** two coexisting systems — **RBS** (official signatures in separate `.rbs`
  files, checked by Steep) and **Sorbet** (inline `sig` blocks, with experimental
  inline-RBS-comment support). Add types only on a library's public surface or a hot,
  bug-prone core — not on throwaway scripts. RuboCop vs Standard config sits in
  [references/gems-and-testing.md](references/gems-and-testing.md).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|--------------|--------------|------------|
| Monkey-patching a core class globally | Action-at-a-distance; collides with gems and future Ruby | A refinement (scoped) or a wrapper/helper |
| `method_missing` without `respond_to_missing?` | `respond_to?`/`method`/duck-typing all lie | Pair them, or prefer `define_method` |
| Mutating a frozen string literal | `FrozenError` after the magic comment | `dup` before mutating, or build a new string |
| `for x in coll` loops | Leaks the loop var; un-idiomatic | `coll.each`/`map`/`select` |
| `rescue Exception` (bare) | Swallows `SignalException`, `NoMemoryError`, exit | `rescue StandardError` (or specific classes) |
| Not committing `Gemfile.lock` for an app | Non-reproducible installs across machines | Commit it for apps; omit only for library gems |
| `eval` of user-derived input | Remote code execution | Parse explicitly; never `eval` untrusted data |
| Over-DSLing config a Hash would serve | Hidden control flow, slow `method_missing` | A plain Hash or `Data` object |
