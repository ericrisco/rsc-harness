# Desktop, mobile and local IPC

Load for desktop and mobile apps and the local machinery around them: privileged helpers, updaters, daemons, webview hosts, deep-link handlers, browser native-messaging hosts, and any client or server talking over local IPC. Native memory and loader safety are in [memory-and-binary.md](memory-and-binary.md); update channel authenticity is a supply-chain class.

## Ground rules for this domain

- Name the attacker's starting point before anything else: a remote web origin, a document from outside, a different app, a different OS account, or a sandboxed child process. "A local user" is not one category. Harm a user can only do to themselves, with their own account and authority, crosses no boundary.
- File paths, process names, bundle or package IDs and sender fields in the request do not authenticate a peer. Real peer authentication is OS peer credentials, code-signing identity, capability handles, or state of a protected channel.
- After parsing, the helper or native bridge has to authorize every operation against the resource it finally touches. A trusted UI or broker in front does not clean arguments an attacker can influence.
- Count the controls that really exist when they are pinned and visible: consent prompts, permissions, entitlements, signing, the OS sandbox, keychain ACLs, the export policy of components.
- Prove on an isolated machine or emulator with dummy profiles and content ([../isolated-execution.md](../isolated-execution.md)); never touch other people's apps, credentials or production services. Verdicts follow [../verification.md](../verification.md). If the result depends on packaging, the merged manifest, signing, installer ACLs, device policy or OS version, and you cannot see it, the finding is needs-validation.

## Deep links, callbacks and handoffs

### `deep-link-ambiguity`

**What.** Another app or a web page invokes a route that changes state, imports data, finishes a login or selects an account, without binding to the current session and a one-time callback value.

**Where to look.** Custom URL scheme and universal/app link handlers, Android `intent-filter` on exported activities, Electron `open-url` / `second-instance`, Windows protocol handlers. Check URI normalization, duplicate query parameters, how scheme/host/path are matched, and whether old links can be replayed.

**How to prove.** Fire the link from a second dummy app or page in an emulator and show the state change without user intent or session binding.

### `handoff-misbinding`

**What.** A login or approval callback (OAuth, SSO, magic link, invite, pairing a device, passwordless sign-in, payment) lands in the wrong place: another installed app, another profile or tenant, or a different pending transaction.

**Where to look.** Redirect URIs on shared custom schemes, missing PKCE or `state`, magic links not tied to the requesting device, pairing codes valid for any account.

**How to prove.** A second local app or profile receives and completes the callback. Bind the state to the initiating app, the live session, the account, the provider, the operation, and an expiry.

### `file-intent-authority`

**What.** Something handed to the app (a file opened by association, a share intent, a dropped item, clipboard content, a notification action, an open-file event) starts a privileged operation, and nobody checked the content type, whether the sender is trusted where that matters, whether the user meant it now, and what the final target is.

**Where to look.** File association handlers that import or execute, `ACTION_SEND` receivers, drop handlers, `application:openURL:` / `open-file` events.

**How to prove.** A dummy file or intent from a lower-trust source causes the privileged action locally.

## Webviews and native bridges

### `bridge-origin-confusion`

**What.** Remote or attacker-controlled frames reach a JavaScript-to-native bridge meant only for packaged content.

**Where to look.** `addJavascriptInterface`, `WKScriptMessageHandler`, Electron `contextBridge` / `preload` / `ipcRenderer`, Tauri commands, CEF bindings. Re-check the origin on every call, and again whenever the view navigates, follows a redirect, opens a subframe or popup, or falls back to an error page. A URL prefix check or a check only at first load is not enough.

**How to prove.** Cite both the navigation/origin control and the privileged native sink, then navigate a local test webview to a hostile page (or via redirect) and call the bridge.

### `overbroad-bridge`

**What.** A generic bridge lets page script choose any command, file, credential, IPC method or OS action it likes.

**Where to look.** Bridges like `invoke(method, args)` or `exec(cmd)`, file APIs taking raw paths, `shell.openExternal` with page-supplied URLs. Check method allowlists, argument normalization, user/tenant authority, gesture or confirmation requirements, and what return values leak.

**How to prove.** Page script in a local build calling a method or path outside the intended set.

### `webview-file-access`

**What.** A page loaded from the network can reach local app files, internal origins or privileged custom schemes, because settings or handlers blur origin lines: file-URL access, universal access from file URLs, mixed content, debugging interfaces, custom protocol handlers.

**Where to look.** `setAllowFileAccessFromFileURLs`, `setAllowUniversalAccessFromFileURLs`, `webSecurity: false`, `allowRunningInsecureContent`, remote debugging left on, custom `app://` handlers serving files outside the bundle.

**How to prove.** A hostile page in the local webview reads a dummy protected file or internal origin.

**Only a note.** A permissive setting with no reachable protected content behind it: hardening.

## Local IPC and exported components

### `ipc-peer-auth-gap`

**What.** A local channel accepts a peer of lower trust and never asks who it is: no OS credential check, no code-identity check, no sandbox token, no proof that the right party owns the channel. Channels include loopback TCP, Unix domain sockets, Windows named pipes, D-Bus, Binder, XPC, browser native messaging, local RPC and shared memory.

**Where to look.** `SO_PEERCRED` / `getpeereid` not used, XPC listeners without code-signing requirement, named pipes with default DACL, servers bound to `127.0.0.1` assuming only the app connects (any local process, and often browser pages, can reach them).

**How to prove.** A dummy lower-trust process calls a meaningful method or reads data behind the channel. No meaningful method behind it means no finding.

### `ipc-claimed-principal`

**What.** The channel is authenticated as one user or app, yet fields inside the request choose a different user, tenant, profile or capability.

**Where to look.** `uid`, `user`, `profile` arguments honoured after peer authentication.

**How to prove.** A peer authenticated as A acts as B by setting the field. Each method and resource must be bound to the peer credential.

### `exported-component-overreach`

**What.** A mobile component or local automation endpoint can be called from outside and performs an action meant for the app itself.

**Where to look.** The final merged `AndroidManifest.xml` (`exported`, intent filters, permission and `signature` protection level, `grantUriPermissions`, path permissions, `activity-alias`), content providers, broadcast receivers, AppleScript/automation dictionaries.

**How to prove.** `adb shell am start` / `content query` from a dummy app in an emulator reaching the action. If export status after packaging is unknown, needs-validation.

### `ipc-lifecycle-confusion`

**What.** One local peer can reply to, cancel or take over another peer's operation. Causes: guessable request IDs, handles that get reused, channels left stale, descriptors a child inherits, socket paths anyone can write, and what happens on restart.

**Where to look.** Socket files in `/tmp` created with loose permissions or before `chmod`, stale socket and lock files reused on restart, file descriptors inherited by child processes, sequential request IDs.

**How to prove.** A second local peer hijacks or cancels the first one's request, or pre-creates the socket path. Review creation permissions and cleanup of sockets, locks, ports and shared mappings.

## Privileged helpers and local files

### `confused-deputy-helper`

**What.** An unprivileged caller gets to choose what the privileged side does (which command runs, which file or service is touched, which user or OS setting changes) and no check happens per operation.

**Where to look.** sudoers rules with wildcards, polkit actions with `allow_any`, UAC-elevated helpers, `SMJobBless` / XPC helpers exposing generic operations. The helper must validate normalized arguments on its own.

**How to prove.** In a VM, call the helper as the unprivileged dummy user and show a privileged effect on a dummy target.

### `installer-path-trust`

**What.** After authorization, an elevated installer, updater or repair tool reads inputs a lower-trust actor can still change: its working directory, packages, scripts, manifests, symlinks, saved repair state.

**Where to look.** Packages staged in user-writable temp folders, post-install scripts read from writable locations, repair modes that re-run steps from user-writable state.

**How to prove.** Swap the staged dummy content after the authorization step in a VM and show the privileged process using it. Tie the authorization to content that cannot change afterwards and to destination paths nobody else controls.

### `local-file-toctou`

**What.** The app checks a file or path, then follows a replacement, symlink, mount, or case/normalization change during a privileged read or write.

**Where to look.** `access()` then `open()`, `stat` then write, path checks by string, writes into directories other users can write. Safe pattern: descriptor-relative operations (`openat`, `O_NOFOLLOW`) and final ownership verification.

**How to prove.** A local race or symlink swap redirecting the privileged write to a dummy target. Parsing after the file is open belongs to [memory-and-binary.md](memory-and-binary.md).

### `local-secret-exposure`

**What.** A secret stored locally can be read by an app, profile or OS user with less authority. Places it hides: keystore or keychain entries, token files, configs, logs, backups, the clipboard, notification previews.

**Where to look.** Keychain items with permissive accessibility or shared access groups, token files with `0644`, Android `allowBackup`, tokens written to logs, secrets copied to the clipboard, sensitive notification previews on the lock screen.

**How to prove.** Name the lower-trust reader and what the credential can do, then read it as that reader in a sandbox.

**Only a note.** A plaintext secret that only the intended OS account can read is not, alone, a finding.

## App state and device lifecycle

### `account-switch-residue`

**What.** After logout or an account switch, the next account sees what belonged to the previous one: caches, local databases, webview storage, widgets, notifications, background tasks, biometric approvals.

**Where to look.** Logout code that clears tokens but not caches, webview cookie stores, scheduled jobs, widget data, multi-profile setups, backup and restore to a new device.

**How to prove.** Log in as dummy A, switch to dummy B on the emulator, and observe A's data or approvals.

### `pending-action-mismatch`

**What.** What the user approved and what runs differ. A biometric prompt, a notification button, a widget, a shortcut, the share sheet or a deferred job authorizes an action other than the one displayed, fires after it expired, or picks up pending state from another profile.

**Where to look.** Notification actions carrying IDs resolved later, biometric prompts not bound to the transaction, deferred operations queued before an account switch.

**How to prove.** A local flow where the confirmed action differs from the executed one. Tie the confirmation to the normalized action, the resource, the account and what is in the foreground at that moment.

## Moves that apply to every class above

- Inventory everything that can be called: processes, helpers, app components, local endpoints, webview origins, URI schemes, file associations. For each: OS identity, runtime privilege, who can call it, what it can do.
- Read what the build actually ships, not only source: the merged manifest, the entitlements file, installer rules, how native messaging and protocol handlers are registered, how ACLs are created. Declarations in source can be overridden later in the build.
- Test only on an emulator or an isolated machine, with made-up profiles and harmless fixtures.

## Checklist before reporting

1. The attacker's starting capability, the OS or app principal crossed, the entry channel, the accepted argument or state, and the unauthorized operation or disclosure.
2. Sandbox, peer credentials, signing, entitlements, permissions, user consent and installer controls that apply are all checked. Unknown packaging or runtime facts mean needs-validation.
3. Webview bridges: both the origin control and the native sink cited. IPC: peer authentication and per-resource authorization. Helpers: the final normalized destination verified.
4. Local tests stay bounded with dummy content and accounts, and stop at the boundary result: no persistence, no wider system changes.
5. Confirmed needs a complete chain of source and local evidence. Otherwise needs-validation, naming the one fact still open: OS behaviour, the manifest, signing, an ACL, or device lifecycle.
