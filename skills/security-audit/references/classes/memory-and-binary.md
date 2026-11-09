# Memory safety, native code and binary loading

Load when untrusted bytes are handled by memory-unsafe or privileged code: C, C++, Objective-C, Rust `unsafe`, FFI bindings, drivers and kernel modules, decoders, network daemons, firmware, loaders, runtimes and JITs. Protocol authorization and message state machines live in [protocols-and-messaging.md](protocols-and-messaging.md); this file is about process integrity.

Split a large target into slices before reading: parsers, allocation and lifetime, FFI, concurrency, loading, runtime/JIT, privileged interfaces.

## Ground rules for this domain

- Work out every bound and every lifetime again yourself, starting from attacker input and covering all callers. Test against the largest input the code accepts, not the friendly test vector.
- A crash, a panic or a sanitizer report is a defect only if realistic untrusted input can drive execution there. A label such as "heap overflow" does not by itself prove corruption, code execution or a shared outage.
- Prove in a local harness only ([../isolated-execution.md](../isolated-execution.md)): sanitizers, deterministic thread schedules, the project's existing fuzz targets, a debugger to classify the fault. Stop once the broken invariant and its visible effect are shown. Never build exploitation past the corruption point.
- Sanitizers have blind spots: hand-written assembly, JIT output, custom allocators, accesses inside one object, prebuilt foreign libraries. Check that the faulting instruction was actually instrumented.
- Verdicts follow [../verification.md](../verification.md). Without known ABI, allocator, architecture, build flag, deployment or reachability facts, the finding stays at needs-validation.

## Bounds and representation

### `out-of-bounds-access`

**What.** A length, offset, index or terminator is used against a fixed or heap buffer without a correct limit, so the code reads or writes outside it.

**Where to look.** `memcpy`, `memmove`, `strcpy`, `sprintf`, manual loops over `buf[i]`, `ptr + off`, slice indexing in `unsafe` blocks, `get_unchecked`. Recompute free space after headers, alignment, padding and the NUL terminator. Check the capacity of both the source and the destination. Check whether the code reads bytes that a truncated input never supplied, because it believed the declared length.

**How to prove.** Untrusted input → the arithmetic that sets the bound → the access. A small fixture under ASan/KASAN showing the invalid read or write at that line.

**Only a note.** An out-of-range access on data the caller fully controls inside its own process, with no trust boundary crossed.

### `integer-arithmetic-flaw`

**What.** Overflow, underflow, truncation or a sign error in attacker-influenced arithmetic that feeds an allocation, copy, loop, index or pointer.

**Where to look.**

| Pattern | Typical result |
|---|---|
| `a - b` where `b` can exceed `a` | huge unsigned length |
| `count * elem_size` | small allocation, large copy |
| additions close to the type maximum | wrap to a small value |
| negative signed value cast to unsigned | huge size |
| 64-bit length stored in a 32-bit field | truncated check, full copy |
| sentinel `-1` used as a size | maximum size |

Confirm which form of the value (checked or unchecked, wide or narrow) the later operation actually uses.

**How to prove.** The boundary value, the wrapped result, and the sink that consumes it, reproduced in a sanitizer build (UBSan for the arithmetic, ASan for the memory effect).

**Only a note.** A theoretical wrap that an earlier cap makes unreachable; cite the cap.

### `unit-confusion`

**What.** Code mixes units: bytes vs elements, code units vs characters, pages, words, wire units, or the element size at the wrong pointer depth.

**Where to look.** Follow one length from parse to validation to allocation to the API boundary to the copy, and write the unit at each step. UTF-16 vs UTF-8 lengths, `sizeof(ptr)` vs `sizeof(*ptr)`, `wchar_t` buffers, page counts multiplied in the wrong place. If the check and the allocation share one wrong unit, the check passes and is still wrong.

**How to prove.** Show the two units side by side in source, then a fixture whose length differs between them, with the resulting out-of-bounds effect.

**Only a note.** A unit mismatch where both values are always equal for every accepted input (for example, a byte-only alphabet).

### `uninitialized-data-exposure`

**What.** Memory that was never fully written (a buffer, struct padding, a field, spare vector capacity) leaves the code: sent across a trust boundary, serialized, hashed, compared or returned.

**Where to look.** Structs copied whole to the wire or to user space, `malloc` without full write, `set_len` / `MaybeUninit` misuse in Rust, responses sized by capacity instead of length.

**How to prove.** A consumer that observes the bytes on the far side of the boundary, with a realistic output length. MSan or a canary pattern shows stale content leaving.

**Only a note.** A stack allocation that is never read before being written, or uninitialized memory that never reaches an observer.

## Lifetime, type and concurrency

### `use-after-free`

**What.** An owner is freed while something can still reach it: a callback, a wait queue, a timer, an iterator, a borrowed slice, a cached raw pointer. Also covers stale views after `realloc` and double frees.

**Where to look.** Every error, cancel, close and `realloc` path, not only the happy path. Objects that embed notification anchors or observer lists: every path that frees must first remove or drain each observer.

**How to prove.** The input sequence that frees then reuses, and the ASan or KASAN use-after-free report pointing at the stale access.

**Only a note.** A dangling pointer that is provably never dereferenced again.

### `type-confusion`

**What.** The code learns an object's kind from one thing (its tag, discriminator, vtable, kind field or foreign handle) and then reads it as some other representation.

**Where to look.** Unchecked downcasts (`static_cast` on a base pointer, `reinterpret_cast`, C union access), tags left stale when an object slot is reused, serialized containers where the validated element type differs from the one consumed.

**How to prove.** A local fixture that makes the code read or write the object as the wrong type. Do not extend the test beyond showing the invariant break.

**Only a note.** A cast guarded by a check on every reachable path.

### `refcount-ownership-race`

**What.** Retain/release that is not atomic, a check and then a use after the lock is dropped, or different ownership rules on different threads, so an object is freed or mutated while in use.

**Where to look.** Compare the fast path, error path, shutdown path and compatibility path for the same object: same lock, same ownership rule? Look for `refcount++` without atomics and `get` then `put` split across a lock release.

**How to prove.** A deterministic schedule (barriers, injected sleeps in a test build) or a ThreadSanitizer trace that shows the bad interleaving and its effect.

**Only a note.** A race with no security-relevant state change.

### `shared-state-toctou`

**What.** Concurrent streams, global caches, lazy initializers, signal handlers or teardown change a bound, policy or pointer after it was checked.

**Where to look.** Globals touched by several parser instances, `once` initializers with fallible setup, signal handlers calling non-reentrant code, teardown racing with in-flight work.

**How to prove.** A repeatable local schedule, a barrier test or TSan output. A merely possible interleaving with no proven security-relevant transition stays at needs-validation.

### `lock-order-deadlock`

**What.** Reachable operations take locks in inconsistent order, or hold a lock across a callback or blocking I/O, and progress stops.

**Where to look.** Lock acquisition graphs, callbacks invoked under a lock, I/O under a mutex.

**How to prove.** A bounded input that halts shared progress. Report it as availability (see [resource-exhaustion.md](resource-exhaustion.md)).

**Only a note.** A deadlock only the operator or the caller's own process can trigger; file it as a concurrency bug to fix, not as a vulnerability.

## FFI and ABI boundaries

### `ffi-ownership-mismatch`

**What.** The two sides of a foreign call disagree on buffer ownership (which side allocates it, mutates it, pins it, releases it), on how long a pointer into it stays valid, or whether a length counts bytes or elements.

**Where to look.** Every `extern` block, CGo, JNI, Python C extensions, N-API, generated wrappers. Check null pointers, zero lengths, aliasing between arguments, callbacks that keep a pointer after the call returns.

**How to prove.** Cite both declarations, then a local test that triggers the double free, leak-then-reuse or wrong-length copy under a sanitizer.

### `abi-layout-mismatch`

**What.** The two sides see different layouts or conventions depending on target architecture or compile flags: struct fields, bitfields, packed records, enums, integer widths, callback signatures, calling conventions.

**Where to look.** `repr(C)` / `repr(packed)`, `#pragma pack`, alignment attributes, endianness, `long` and `size_t` widths, enum sizes, `stdcall` vs `cdecl`.

**How to prove.** When both declarations are in the repo, a size/offset assertion or a test that misreads a field confirms it. When the foreign implementation is opaque, needs-validation.

### `unwind-and-thread-affinity`

**What.** A panic or exception crosses an ABI that forbids unwinding, a callback runs after teardown, or a single-thread API is called from another thread.

**Where to look.** `extern "C"` functions that can panic, C++ exceptions escaping into C, UI or runtime APIs called from worker threads, cancellation during a callback.

**How to prove.** Show what actually happens: a clean abort (lower impact) or corrupted state (higher). Do not assign impact before observing which.

## Binary loading and runtimes

### `library-search-order-hijack`

**What.** A process with privileges maps code (a shared library, a plugin, a helper binary, a runtime image) from a location that someone with less trust can write, or resolves a bare name through a working directory or environment variable an attacker can influence.

**Where to look.** `dlopen`, `LoadLibrary`, `LD_LIBRARY_PATH`, `DYLD_*`, `@rpath`, plugin directories, `PATH` lookups of helpers, fallback and compatibility search paths. Compare each candidate path's owner with the install owner.

**How to prove.** Name the lower-trust writer, the writable path, and show the privileged process mapping a planted dummy library in a sandbox.

**Only a note.** Someone loading a plugin of their choice into a process they already own: no boundary is crossed.

### `verify-then-load-gap`

**What.** The loader checks one file or metadata record but maps something else, because path resolution, file replacement, multi-architecture slices or embedded resources are not tied to the check.

**Where to look.** Signature checks by path followed by a second open, fat binaries where one slice is checked and another loaded, resources loaded separately from the verified container. Authenticity of the delivery channel itself is a supply-chain question, not this class.

**How to prove.** Show the checked identity and the mapped identity differ, and name who can make them differ.

### `malformed-binary-metadata`

**What.** Section and symbol tables, relocations, counts, offsets, bytecode or debug info inside a binary format are used before the code checks that they stay in range, do not overlap, and have the expected representation.

**Where to look.** ELF/PE/Mach-O/WASM/bytecode parsers, relocation appliers, symbol table walkers, debug-info readers.

**How to prove.** A small crafted fixture under sanitizers. Separate real memory corruption from a malformed file that is rejected safely.

**Only a note.** A clean rejection or a controlled error.

### `jit-consistency`

**What.** The validator, interpreter, optimizer and generated code disagree on types, bounds, side effects or lifetimes.

**Where to look.** Bounds-check elimination, type speculation, inlining assumptions, deoptimization paths.

**How to prove.** Run the same local input through optimized and unoptimized tiers and show a process-integrity difference (out-of-bounds, wrong type).

**Only a note.** Output that differs between tiers but stays within the language's defined semantics.

### `unload-teardown-dangling`

**What.** Code or data owned by a module (function pointers, registered callbacks, threads it started, views into its memory) stays reachable after the module unloads or the runtime resets.

**Where to look.** Shutdown code and failed-load cleanup, reviewed as closely as startup. Registered callbacks not unregistered, threads not joined.

**How to prove.** Unload then trigger the callback in a harness; sanitizer shows the stale call.

## Kernel and privileged interfaces

### `user-copy-double-fetch`

**What.** Kernel code (an ioctl, a syscall, a driver, an in-kernel parser) validates a value read from user memory, then fetches it from that user address a second time, after the user may have changed it.

**Where to look.** Repeated `copy_from_user` / `get_user` on the same pointer, length read once and data read later. Also check size, direction and access checks at every user-copy primitive.

**How to prove.** Cite both reads; a local VM test with a racing thread that changes the value between them. The fix is one full copy or revalidation of the second copy.

### `privileged-object-lifecycle`

**What.** Objects reachable from outside have unbalanced retain/release, teardown that skips observer drain, unchecked selector or table indices, or a duplicated compatibility path that omits a guard.

**Where to look.** Diff each dispatch path and each free path side by side: 32-bit compat handlers, legacy ioctls, method tables indexed by user selectors.

**How to prove.** The missing guard on one path and a VM-local trigger showing its effect.

### `under-authorized-privileged-interface`

**What.** An admin socket, device node, management API or helper checks that a request is well formed, and never asks whether this caller may act on the target resource.

**Where to look.** Device node permissions, admin socket handlers, management RPCs with no caller check.

**How to prove.** Establish who can actually reach the interface. If permissions or sandbox policy live outside the repo, needs-validation.

## Moves that apply to every class above

- When a fix lands for one source-to-sink shape, look for the same shape in siblings. Guarding one caller does not guard the rest; the same holds for one architecture, one protocol role, one feature flag, one compat path.
- For each parser or FFI boundary, fill one row: accepted length and type, checked representation, allocation owner, consumer, thread, teardown. Most native findings are one cell that disagrees with another.
- Use existing corpora and small local boundary fixtures. Keep the exact sanitizer or runtime output, and note which property of the input causes it. No large resource use, no live target.

## Checklist before reporting

1. A realistic untrusted entry point and the exact operation that breaks an invariant (lifetime, bounds, ABI, type, concurrency, loading or authority).
2. The observed effect, named precisely: out-of-bounds read or write, use of a stale alias, access to the wrong object, leaked uninitialized bytes, an image loaded without authority, a deadlock, or a clean termination. Claim nothing stronger than what was seen.
3. The narrowest harness, test, sanitizer or fuzzer that reproduces it, with sanitizer coverage of the faulting operation checked and architecture and build flags recorded.
4. Concurrency: a deterministic schedule or a sanitizer trace. Loading: checked identity differs from mapped identity, and the lower-trust writer is named.
5. Confirmed needs exact input, source trace and observed result. Otherwise needs-validation, naming the one missing fact (reachability, ABI, build, deployment, runtime) and the check that would settle it.
