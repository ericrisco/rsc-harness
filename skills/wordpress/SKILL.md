---
name: wordpress
description: "Use when building or hardening WordPress sites or WooCommerce stores and treating WordPress as the product rather than just writing PHP — block themes with theme.json, plugins with block.json and proper hooks, wp-config security hardening, performance (object cache, asset loading, autoloaded options), and WP-CLI operations. NOT a Laravel app (that is `laravel`)."
tags: [wordpress, woocommerce, block-themes, wp-cli, php, security-hardening, performance]
recommends: [php, secure-coding, performance, mysql, shopify]
origin: risco
---

# WordPress

You are building the WordPress application layer — themes, plugins, the dashboard/CLI surface, security, and stores — for someone treating WordPress as the product. Know the difference between a `functions.php` hack and a real plugin. Refuse to paste secrets into the dashboard file editor. Pick block themes over page builders by default. Reach for `wp` before clicking through wp-admin.

This is not generic PHP. If there is no WordPress API in sight (value objects, Composer/PSR-4, PHPStan), that is [php](../php/SKILL.md). A Laravel app is [laravel](../laravel/SKILL.md).

## Version & runtime targeting

Target current. Stale version assumptions are the most common way WP code rots.

- **WordPress 6.9** (released 2025-12-02) is current; it refines speculative loading and supports PHP 8.5. WP 6.8 ("Cecil", 2025-04-15) added bcrypt password hashing and speculative loading. *Why: features below assume 6.6+ APIs (`wp_enqueue_block_style`, theme.json v3).*
- **PHP 8.4 is the recommended runtime for 2026.** WP 6.9 fully supports PHP 8.5; WP 6.8+ fully supports 8.4; WP 6.4+ supports 8.3. **Never target PHP 7.x or 8.0–8.2 for new code — all EOL.** *Why: writing for a dead runtime ships deprecation bugs the host will eventually refuse to run.*
- **theme.json v3** is the schema for new block themes (WP 6.6+). Locally set `WP_DEVELOPMENT_MODE` to `all` so theme.json edits are not cached for 30+ seconds. *Why: without it you will edit theme.json, see nothing change, and waste an hour.*

```php
// wp-config.php — local dev only, never on production
define( 'WP_DEVELOPMENT_MODE', 'all' );
define( 'WP_DEBUG', true );
define( 'SCRIPT_DEBUG', true );
```

## Decision: how heavy is the change?

Pick the lightest artifact that survives an update. The failure mode is everyone reaching for `functions.php` or editing files that get overwritten.

| You need to… | Artifact | Do NOT |
| --- | --- | --- |
| One-line tweak, site-specific behavior | mu-plugin in `wp-content/mu-plugins/` | dump it in the active theme's `functions.php` |
| Change look of a third-party theme | **child theme** | edit the parent theme — updates wipe it |
| Reusable feature, hooks, blocks, CPTs | **standalone plugin** | hide app logic in `functions.php` |
| Full custom front end | **block theme** + theme.json v3 | reach for a page builder for structural layout |
| Sell products | block theme + **WooCommerce** | hand-roll a cart |

## Block themes

A block theme is `theme.json` + HTML templates in `templates/` and `parts/`. Start from a v3 skeleton:

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {
    "appearanceTools": true,
    "color": {
      "palette": [
        { "slug": "base", "color": "#ffffff", "name": "Base" },
        { "slug": "contrast", "color": "#111111", "name": "Contrast" }
      ]
    },
    "typography": {
      "fluid": true,
      "fontFamilies": [
        { "fontFamily": "system-ui, sans-serif", "slug": "system", "name": "System" }
      ]
    },
    "layout": { "contentSize": "640px", "wideSize": "1100px" }
  },
  "styles": {
    "color": { "background": "var(--wp--preset--color--base)", "text": "var(--wp--preset--color--contrast)" }
  }
}
```

Templates resolve by hierarchy: `templates/index.html` is the fallback; `single.html`, `archive.html`, `page.html`, `404.html` override it. Reusable chunks live in `parts/` (`header.html`, `footer.html`).

Register patterns by dropping PHP-headered HTML in `patterns/`; they appear in the inserter automatically. Enqueue CSS **per block** so it only loads when the block renders:

```php
add_action( 'init', function () {
	wp_enqueue_block_style( 'core/group', array(
		'handle' => 'mytheme-group',
		'src'    => get_theme_file_uri( 'assets/blocks/group.css' ),
		'path'   => get_theme_file_path( 'assets/blocks/group.css' ),
	) );
} );
```

Rule: never hand-write `<link>`/`<script>` tags in templates — the browser cannot cache them and you lose dependency management. Always enqueue. And never edit a parent theme directly; make a child theme.

## Plugins

A plugin is a folder with a headered main file. That header is what makes it a plugin:

```php
<?php
/**
 * Plugin Name: Acme Books
 * Description: Registers the book CPT and a related block.
 * Version:     1.0.0
 * Requires PHP: 8.4
 * Requires at least: 6.9
 */
defined( 'ABSPATH' ) || exit; // never expose a direct hit
```

Hooks split two ways: **actions** fire at a point in execution (`add_action('init', …)`); **filters** transform a value and must `return` it (`add_filter('the_content', …)`). Confusing them is a top-five WP bug.

Register a block from a `block.json` — never duplicate metadata in PHP:

```php
add_action( 'init', function () {
	register_block_type( __DIR__ . '/build/related-books' ); // reads block.json
} );
```

Register a custom post type with explicit capabilities and labels:

```php
add_action( 'init', function () {
	register_post_type( 'book', array(
		'public'       => true,
		'show_in_rest' => true, // required for the block editor
		'supports'     => array( 'title', 'editor', 'thumbnail' ),
		'labels'       => array( 'name' => 'Books', 'singular_name' => 'Book' ),
	) );
} );
```

Every write path needs a **capability check + nonce**, and every output/query needs escaping/sanitizing. This is the line between a plugin and a vulnerability.

```php
// Bad — SQL injection, no auth
$rows = $wpdb->get_results( "SELECT * FROM {$wpdb->posts} WHERE post_author = $id" );

// Good — capability, nonce, prepared statement
if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'nope' ); }
check_admin_referer( 'acme_save' );
$rows = $wpdb->get_results( $wpdb->prepare(
	"SELECT * FROM {$wpdb->posts} WHERE post_author = %d", $id
) );
echo esc_html( $rows[0]->post_title );
```

Sanitize on input (`sanitize_text_field`, `absint`), escape on output (`esc_html`, `esc_attr`, `esc_url`, `wp_kses` for allowed HTML).

## Security hardening

The single highest-impact habit is keeping core, plugins, and themes updated — 2024 saw 7,966 new ecosystem vulnerabilities, +34% YoY, and the vast majority hit known-vulnerable extensions. Baseline `wp-config.php` constants:

```php
define( 'DISALLOW_FILE_EDIT', true );  // kills dashboard Theme/Plugin editor; SFTP/Git unaffected
define( 'WP_AUTO_UPDATE_CORE', 'minor' );
define( 'FORCE_SSL_ADMIN', true );
```

Use **Application Passwords** (WP 5.6+) for REST/API machine auth — individually revocable, cannot log into `wp-login.php`, and the right answer when a script or [nextjs](../nextjs/SKILL.md) front end needs to talk to WP. Never reuse the admin password in a script.

For the full block — file-permission matrix (dirs 755 / files 644 / wp-config 600), `DISALLOW_FILE_MODS`, nginx/.htaccess security headers, login lockdown, XML-RPC and user-enumeration disabling, version-disclosure removal — see [references/hardening.md](references/hardening.md). Generic OWASP/threat-modeling not tied to the WP attack surface is [secure-coding](../secure-coding/SKILL.md).

## Performance

Two caches, different jobs: an **object cache** (Redis/Memcached via a drop-in) memoizes DB query results across requests; a **page cache** stores whole rendered HTML pages. You usually want both. Then:

- **Audit autoloaded options** first when wp-admin crawls — a few MB of autoloaded junk loads on *every* request. Find offenders with the SQL in the reference.
- Enqueue assets per block (above); defer/async non-critical scripts.
- Speculative loading (prerender/prefetch on hover) ships in 6.8+; tune it rather than bolting on a plugin.

Full Redis wiring, the autoload audit query, transients, and a WP-tied Core Web Vitals checklist are in [references/performance.md](references/performance.md). Generic CWV/load-testing methodology divorced from WordPress is the [performance](../performance/SKILL.md) sibling.

## WooCommerce

**HPOS** (High-Performance Order Storage) is the default order datastore for new installs since WooCommerce 8.2 — orders live in dedicated tables, not `wp_posts`. Enable/migrate and verify with WP-CLI:

```bash
wp wc hpos enable            # turn on custom order tables
wp wc cot sync               # backfill/sync existing orders
wp wc cot verify_cot_data    # confirm parity before flipping authority
```

Any plugin that touches orders **must declare HPOS compatibility**, or WooCommerce disables it in HPOS mode:

```php
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
			'custom_order_tables', __FILE__, true
		);
	}
} );
```

Store/checkout/product setup checklist and migration caveats: [references/woocommerce.md](references/woocommerce.md). A Shopify store is the [shopify](../shopify/SKILL.md) sibling.

## WP-CLI & local dev

`wp` is the operational backbone — scriptable, faster than the dashboard, and safe on serialized data.

- **Local stack:** `wp-env start` (Dockerized WP). Scaffold a block/plugin with `npx @wordpress/create-block acme-block`.
- **Migrations:** `wp search-replace` is serialization-safe — never run a raw SQL `REPLACE` on the DB, it corrupts serialized arrays. Dry-run first:

```bash
wp search-replace 'https://staging.example.com' 'https://example.com' --all-tables --dry-run
wp db export backup.sql        # always export before a real run
wp search-replace 'https://staging.example.com' 'https://example.com' --all-tables
```

- **Cron:** WP's pseudo-cron only fires on traffic. For reliable schedules, define `DISABLE_WP_CRON` true and run `wp cron event run --due-now` from real system cron.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| App logic in `functions.php` | Dies with the theme; not portable | Standalone plugin or mu-plugin |
| Editing a parent theme / core files | Wiped on update | Child theme; hooks/filters |
| `query_posts()` | Breaks the main query, no pagination | `WP_Query` or `pre_get_posts` |
| `$wpdb->query("… $var …")` | SQL injection | `$wpdb->prepare()` with `%d`/`%s` |
| `<script src>`/`<link>` in templates | Not cached, no dependency graph | `wp_enqueue_script/style`, `wp_enqueue_block_style` |
| Secrets pasted in dashboard file editor | Logged, world-readable, version-control blind | `wp-config.php` constants + `DISALLOW_FILE_EDIT` |
| Page builder for structural layout | Bloat, lock-in, broken CWV | Block theme + patterns |
| Disabling auto-updates, never patching | 7,966 vulns/yr land on stale plugins | `WP_AUTO_UPDATE_CORE`; `wp plugin update --all` |
| Raw SQL `REPLACE` to change URLs | Corrupts serialized data | `wp search-replace` |
| Order-touching plugin without HPOS declaration | WooCommerce disables it | `FeaturesUtil::declare_compatibility` |

## verify.sh

`scripts/verify.sh <path>` statically scans theme/plugin/config code for these anti-patterns — committed DB creds or `AUTH_KEY`/salt literals, missing `DISALLOW_FILE_EDIT` when a `wp-config.php` is in scope, `eval(`/`base64_decode(`, `query_posts(`, unprepared `$wpdb` interpolation, and hardcoded `<script src=`/`<link rel="stylesheet">` in PHP templates. Read-only; exits 0 on a clean or empty target, non-zero on any FAIL so it can gate CI.
