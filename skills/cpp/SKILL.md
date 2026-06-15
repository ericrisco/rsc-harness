---
name: cpp
description: "Use when writing, reviewing, modernizing, building, or debugging C++ - RAII and resource lifetime, smart-pointer ownership (unique_ptr/shared_ptr/weak_ptr), move semantics and the Rule of Zero/Five, target-based CMake with FetchContent, and killing undefined behavior with ASan/UBSan/TSan plus clang-tidy. Triggers: \"modernize this C++\", \"who owns this pointer\", \"use-after-free\", \"double free\", \"dangling reference\", \"segfault under load\", \"should this move be noexcept\", \"write a CMakeLists with FetchContent\", .cpp/.hpp/.ixx files, \"revisa este código C++\", \"tengo un segfault\", \"fuga de memoria\". NOT borrow-checker / Result-Option / cargo memory-safety (that is rust)."
tags: [cpp, c++, modern-cpp, raii, cmake]
recommends: [rust, secure-coding, deployment]
origin: risco
---

# Modern C++

Write, review, modernize, build, and debug C++ the way the C++ Core Guidelines intend:
RAII for every resource, ownership made explicit through smart pointers and values, no
undefined behavior by construction, and a target-based CMake build proven clean under
sanitizers.

Targets **C++20/23** for production today. C++23 is ISO/IEC 14882:2024; WG21 froze C++26's
technical content on **2026-03-28** (ISO publication follows) — adopt C++26 features only
behind confirmed compiler support. Compiler matrix:

| Compiler | C++23 | C++26 | Flag |
| --- | --- | --- | --- |
| GCC | since 11 | since 14 (GCC 16.1 covers most of C++26) | `-std=c++23` / `-std=c++26` |
| Clang | 13–18 progressively | in progress (Clang 23 dev) | `-std=c++23` / `-std=c++2c` |
| MSVC | latest | partial | `/std:c++23` / `/std:c++latest` |

## When to use / When NOT to use

**Use when:**

- Authoring or reviewing any `.cpp` / `.cc` / `.hpp` / `.h` / `.ixx` (module) file.
- Deciding ownership: value / `unique_ptr` / `shared_ptr` / `weak_ptr` / borrowed `span` / `string_view` / `const&`.
- Modernizing legacy C++: ripping out `new`/`delete`, owning raw pointers, manual loops, C-style casts.
- Writing or fixing a **CMake** build (target-based, `FetchContent`, presets).
- Hunting UB: enabling ASan/UBSan/TSan, reading the report, applying the lifetime/bounds/overflow/race fix.
- Move semantics / Rule of Zero/Five / value-category and `noexcept` questions.

**When NOT to use (delegate):**

- Rust borrow-checker, `Result`/`Option`, cargo, ownership-via-compiler -> [`rust`](../rust/SKILL.md).
  C++ buys safety with discipline (RAII + smart pointers + sanitizers); do not conflate the mechanisms.
- Language-agnostic threat modeling, authz, OWASP-class review -> [`secure-coding`](../secure-coding/SKILL.md)
  (this skill keeps the C++-specific controls: bounds, lifetime, integer overflow, format-string, sanitizers).
- Containerizing/shipping the binary (Dockerfile, GitHub Actions) -> [`deployment`](../deployment/SKILL.md)
  (this skill stops at the CMake build + a sanitizer-CI note).
- Recording per-project C++ conventions in a workspace wiki -> [`harness`](../harness/SKILL.md)
  (see "Project grounding" below).

The C++-specific memory/UB controls — sanitizers, bounds, lifetime, signed overflow — live
**here**, not in `secure-coding`.

## Decision rules

Apply these on every C++ edit:

1. **Rule of Zero first.** Manage resources with members that already do it (`vector`, `string`,
   `unique_ptr`); write no destructor/copy/move at all. Why: hand-written special members are the
   #1 source of leaks and double-frees.
2. **Value by default.** Pass and return by value for small/copyable types; reach for the heap
   only when you need polymorphism, shared lifetime, or a large/stable address. Why: values can't dangle.
3. **Name the owner.** Exactly one type owns each resource; everyone else borrows. Why: ambiguous
   ownership is how use-after-free is born.
4. **`make_unique`/`make_shared`, never `new`.** Why: no naked owning pointer ever exists, so there
   is nothing to forget to `delete`, and it's exception-safe.
5. **Never an owning raw pointer.** Raw pointers/references are non-owning borrows only. Why: a raw
   pointer that owns is a leak or a double-free waiting on the next early `return`/throw.
6. **Borrow with `span` / `string_view` / `const T&`.** Pass a view, not a copy or an owner, for
   read access. Why: zero-copy and the callee provably can't free what it doesn't own.
7. **`const` and `constexpr` by default.** Make everything you can immutable and compile-time. Why:
   the compiler enforces what you don't mutate and moves work off the hot path.
8. **No UB by construction.** No use-after-move, OOB index, signed overflow, uninitialized read, or
   data race. Why: UB is not a runtime error — the optimizer is licensed to do anything.
9. **Sanitizers + warnings-as-errors in CI.** Build and test under `-fsanitize=address,undefined`
   with `-Werror`. Why: most C++ bugs are invisible until a sanitizer or a warning surfaces them.
10. **Target-based CMake only.** `target_link_libraries` / `target_compile_features`, never
    directory-level `include_directories`/`link_libraries`. Why: directory commands leak flags globally and break composition.

## Ownership & smart pointers

Pick the type from the *need*, not from habit:

| Need | Use |
| --- | --- |
| Exclusive owner, one place frees it | `std::unique_ptr<T>` |
| Genuinely shared lifetime (multiple owners, last one frees) | `std::shared_ptr<T>` |
| Observe / break a `shared_ptr` cycle, no ownership | `std::weak_ptr<T>` (`.lock()` to use) |
| Read-only borrow of contiguous range / string | `std::span<const T>` / `std::string_view` |
| Borrow a single object, non-owning | `const T&` / `T&` / `T*` (never owning) |
| Small, copyable, value-like | the value itself — no heap |

Default to `unique_ptr`; only escalate to `shared_ptr` when ownership is *actually* shared, and
prove the shared case isn't a disguised single owner first — `shared_ptr` is not "the safe default."

```cpp
// Bad: naked owning pointer; leaks on the throw, double-frees if you copy the handle.
Widget* w = new Widget(cfg);
configure(w);            // if this throws, w leaks
delete w;

// Good: ownership is the type; freed exactly once, exception-safe, no delete to forget.
auto w = std::make_unique<Widget>(cfg);
configure(*w);
```

```cpp
// Bad: parent <-> child shared_ptr cycle -> neither refcount hits zero -> leak forever.
struct Node { std::shared_ptr<Node> parent, child; };

// Good: child owns down, parent observes up. Cycle broken; lock() before use.
struct Node {
    std::shared_ptr<Node> child;   // owns
    std::weak_ptr<Node>   parent;  // observes
};
if (auto p = node.parent.lock()) { /* p is a valid shared_ptr here */ }
```

When an object must hand out a `shared_ptr` to itself, derive from
`std::enable_shared_from_this<T>` and call `shared_from_this()` — never wrap `this` in a fresh
`shared_ptr` (that creates a second, independent refcount and a guaranteed double-free).

Deeper ownership/move reasoning -> `references/move-and-templates.md`.

## RAII

Tie every resource — heap memory, file, socket, mutex, OS handle — to an object's lifetime; the
destructor releases it. Why: cleanup then happens on *every* exit path (return, exception, break)
for free, with no GC and no `finally`.

Use the standard guards before writing your own:

```cpp
std::lock_guard  lock(mtx_);            // locks now, unlocks at scope end (C++17 CTAD)
std::scoped_lock locks(a_mtx, b_mtx);   // multiple mutexes, deadlock-free acquisition
std::unique_lock lk(mtx_);              // movable / deferrable, for condition_variable
std::ifstream    in("data.txt");        // closes in its destructor
```

When you wrap a C resource yourself, make the destructor release and disable copies (Rule of Five
or `unique_ptr` with a custom deleter):

```cpp
// RAII wrapper for a FILE*: closes once, can't leak, can't double-close.
class File {
public:
    explicit File(const char* path, const char* mode) : f_(std::fopen(path, mode)) {
        if (!f_) throw std::runtime_error("open failed");
    }
    ~File() { if (f_) std::fclose(f_); }
    File(const File&) = delete;                 // not copyable
    File& operator=(const File&) = delete;
    File(File&& o) noexcept : f_(std::exchange(o.f_, nullptr)) {}        // move = steal
    File& operator=(File&& o) noexcept { std::swap(f_, o.f_); return *this; }
    FILE* get() const noexcept { return f_; }
private:
    FILE* f_{};
};
// Even simpler when a deleter suffices — let unique_ptr own it (Rule of Zero):
auto fp = std::unique_ptr<FILE, decltype(&std::fclose)>(std::fopen("d", "r"), &std::fclose);
```

## Move semantics & Rule of Zero/Five

Every expression is an *lvalue* (has a name, persists) or an *rvalue* (a temporary, about to die).
`std::move` does not move anything — it casts an lvalue to an rvalue so a move constructor/assignment
can *steal* its guts instead of copying. After you move from an object, it is valid but unspecified:
only assign to it or destroy it; reading it is **use-after-move** (a real bug ASan/UBSan won't catch — clang-tidy will).

- **Rule of Zero** (default): manage nothing by hand; let the compiler generate all five special
  members. This is correct for the vast majority of types.
- **Rule of Five**: the moment you write *one* of destructor / copy-ctor / copy-assign / move-ctor /
  move-assign, you must reason about all five. If you're writing them, you probably should have used
  a `unique_ptr`/`vector` member and gone back to Rule of Zero.
- **Move ops must be `noexcept`.** Why: `std::vector` reallocation only *moves* elements instead of
  copying them when the move is `noexcept` — otherwise it silently falls back to copies for the
  strong exception guarantee.

```cpp
std::vector<std::string> v;
v.push_back(std::move(name));   // transfers the buffer; `name` is now empty-but-valid
// Bad: use-after-move — `name` holds an unspecified state here.
log(name);                      // don't. Reassign name first, or just don't read it.
```

Return local objects by value and let **RVO / copy elision** remove the copy — do *not* `return
std::move(local)`, which pessimizes by blocking elision. Take a forwarding reference `T&&` plus
`std::forward<T>(x)` only in generic code that must preserve value category.

Worked Rule-of-Five, perfect forwarding, CTAD, and C++20 concepts -> `references/move-and-templates.md`.

## Avoiding UB (essentials)

Undefined behavior is the compiler's permission to assume the bug can't happen and optimize on that
assumption — so the symptom is often a *distant* crash or a "works in Debug, breaks in Release." Pair
static analysis (clang-tidy, cppcheck) with dynamic sanitizers; they catch disjoint bug classes.

| Sanitizer | Flag | Catches |
| --- | --- | --- |
| AddressSanitizer | `-fsanitize=address` | use-after-free, heap/stack buffer overflow, double-free |
| UndefinedBehaviorSanitizer | `-fsanitize=undefined` | signed overflow, null/misaligned deref, bad shifts, invalid enum |
| ThreadSanitizer | `-fsanitize=thread` | data races |

Combine **ASan + UBSan** in one build (`-fsanitize=address,undefined`); run **TSan alone** (it's
incompatible with ASan). Always add `-fno-omit-frame-pointer -g` for readable reports.

```cpp
// Bad: returns a dangling reference into a destroyed temporary -> use-after-free, ASan fires.
const std::string& name() { std::string s = build(); return s; }   // s dies at return

// Good: return by value; RVO makes it free.
std::string name() { return build(); }
```

The full catalog (lifetime, OOB, signed overflow, strict-aliasing, uninitialized, data races,
use-after-move), which sanitizer surfaces each, the canonical fix, and a "reading an ASan report"
walkthrough -> `references/undefined-behavior.md`.

## Modern CMake (essentials)

Target-based only. State requirements on the *target*, never globally:

```cmake
cmake_minimum_required(VERSION 3.21)
project(app LANGUAGES CXX)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)   # feeds clang-tidy / clangd

include(FetchContent)                   # FetchContent ships with CMake since 3.11
FetchContent_Declare(Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG        v3.7.1)
FetchContent_MakeAvailable(Catch2)      # its targets work just like find_package targets

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_23)     # request the standard on the target
target_compile_options(app PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(app PRIVATE Catch2::Catch2WithMain)
```

Full template (src/include/tests layout, `CMakePresets.json` with debug/asan/release presets,
fmt + GoogleTest via FetchContent, per-compiler warning + sanitizer flags, install/export) ->
`references/cmake.md`.

## Standard-library idioms

Reach for the library before hand-rolling:

```cpp
#include <algorithm>
#include <ranges>
#include <expected>   // C++23
#include <format>     // C++20

// Ranges over raw index loops — no off-by-one, no manual bounds.
auto evens = nums | std::views::filter([](int n){ return n % 2 == 0; });
std::ranges::sort(v);

// std::expected (C++23) over out-params / sentinel returns / exceptions for expected failure.
std::expected<Config, std::string> load(std::string_view path);
if (auto cfg = load(p)) use(*cfg); else log(cfg.error());

std::optional<User> find(int id);            // "maybe absent", not a magic -1 / nullptr
std::span<const int> view(v);                // borrow a contiguous range, no copy, no owner
auto [it, inserted] = m.try_emplace(k, val); // structured bindings
enum class Color { Red, Green };             // scoped, no implicit int conversions
std::string msg = std::format("{} of {}", i, n);  // type-safe, no printf format-string UB
```

Prefer `at()` or a range-checked view when the index isn't provably in bounds; `operator[]` on a
bad index is UB, not an exception.

## Testing & tooling

- **Tests:** Catch2 or GoogleTest pulled via `FetchContent` (above); run them with `ctest`.
- **Static analysis:** `clang-tidy -p build` (reads `compile_commands.json`) and `cppcheck` —
  they catch use-after-move, missing `noexcept`, and lifetime bugs the compiler won't.
- **Dynamic analysis:** run the test target under ASan+UBSan so tests *prove* no UB on covered paths.
- **Format:** `clang-format -i` with a checked-in `.clang-format`.
- **Local gate:** `./scripts/verify.sh` from the project root runs format + an ASan/UBSan,
  warnings-as-errors build + `ctest` + optional tidy/cppcheck. Missing tools are skipped, not failed.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality / Do instead |
| --- | --- |
| "I'll just `new`/`delete` carefully" | One early return or throw and you leak/double-free. `make_unique`, always. |
| "A raw owning pointer is faster" | `unique_ptr` is zero-overhead; the cost is imaginary, the leak is real. |
| "`shared_ptr` everywhere is the safe default" | Shared ownership invites cycles + atomic refcount cost. Default `unique_ptr`; share only when truly shared. |
| "The C-style cast is fine, I know the type" | Use `static_cast`/`dynamic_cast`; C casts silently reinterpret and hide bugs. |
| "Skip `noexcept` on the move ctor" | `vector` then copies instead of moving on realloc. Mark moves `noexcept`. |
| "UB won't happen on my compiler" | UB lets the optimizer delete your checks; "works in Debug" proves nothing. |
| "No sanitizers, it ran fine" | It ran; it wasn't *correct*. Build+test under ASan+UBSan. |
| "A hand-rolled Makefile is simpler" | It rots and leaks flags. Target-based CMake is the contract. |
| "`v[i]` is in range, I checked" | If it's not provable, use `.at()` or a checked view; OOB is UB. |
| "`return std::move(local)` to be fast" | It blocks RVO and is slower. Return the local by value. |
| "`using namespace std;` in a header" | Pollutes every includer; ODR/ambiguity bugs. Never in a header. |
| "An out-param instead of returning the value" | Return by value (RVO) or `optional`/`expected`; out-params hide aliasing and UB. |
| "A global / singleton is simpler" | It's hidden shared mutable state -> data races + untestable. Inject it. |

## Quick reference

| Task | Command / idiom |
| --- | --- |
| Configure + build | `cmake -S . -B build && cmake --build build` |
| Configure with sanitizers | `cmake -S . -B build -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -g"` |
| Test | `ctest --test-dir build --output-on-failure` |
| ASan + UBSan | `-fsanitize=address,undefined -fno-omit-frame-pointer -g` |
| ThreadSanitizer (alone) | `-fsanitize=thread -g` |
| Format | `clang-format -i src/*.cpp` |
| Static analysis | `clang-tidy -p build src/*.cpp` · `cppcheck --enable=warning src/` |
| Std flag | GCC/Clang `-std=c++23` (C++26: GCC `-std=c++26`, Clang `-std=c++2c`), MSVC `/std:c++23` |
| Own a resource | `auto p = std::make_unique<T>(...);` |
| Borrow a range | `std::span<const T>` / `std::string_view` |
| Local gate | `./scripts/verify.sh` (run in your project root) |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md)
Karpathy wiki), record this project's C++ decisions there and index them in `02-DOCS/wiki/index.md`,
so the next agent inherits them instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/cpp.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — std version and
   compiler matrix, CMake layout and presets, the sanitizer/warning policy, and the ownership/error
   conventions — then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the article
   (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Technical conventions are
*recorded, not gated* — never block the task on this.

## See Also

Sibling skills (all resolve under `skills/`):

- [`rust`](../rust/SKILL.md) - the other systems language; compiler-enforced ownership instead of
  RAII discipline. Any borrow-checker / `Result`-`Option` / cargo question goes there.
- [`secure-coding`](../secure-coding/SKILL.md) - language-agnostic threat modeling and authz/abuse
  review (this skill keeps the C++-specific memory/UB controls).
- [`deployment`](../deployment/SKILL.md) - containerizing and shipping the built binary (this skill
  stops at the CMake build + a sanitizer-CI note).
- [`harness`](../harness/SKILL.md) - the `02-DOCS/` workspace wiki where per-project C++ conventions
  are recorded (see "Project grounding").

Local references (read when):

- `references/cmake.md` - full target-based CMake template, presets, FetchContent, sanitizer/warning flags.
- `references/undefined-behavior.md` - the UB catalog, which sanitizer catches each, fixes, ASan-report walkthrough.
- `references/move-and-templates.md` - value categories, Rule of Five, perfect forwarding, CTAD, C++20 concepts.
