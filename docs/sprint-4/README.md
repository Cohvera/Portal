# Sprint 4 - Plugin Manager

Sprint 4 introduces a LoxBerry-style administration layer for Cohvera plugins.

## What is included

- `/admin/plugins` administration page
- central database-backed plugin registry
- install/update of external plugins from an HTTPS manifest URL
- enable/disable plugins per company
- uninstall external plugins
- built-in plugins protected against uninstall
- admin mutation protection with `PLUGIN_ADMIN_TOKEN`
- source, manifest and entrypoint metadata

## External plugin model

The first runtime-safe installer does not execute arbitrary ZIP code inside the Portal container. Instead, an external plugin publishes a small JSON manifest over HTTPS. The Portal downloads and validates that manifest and registers the plugin. The plugin itself runs independently behind its own HTTPS entrypoint. This preserves fault isolation: installing or upgrading a plugin cannot modify or overwrite the Portal core or another plugin.

Example manifest:

```json
{
  "id": "example-external-tool",
  "name": "Example External Tool",
  "version": "1.0.0",
  "description": "Example Cohvera plugin",
  "apiVersion": "1",
  "entrypointUrl": "https://tool.example.org",
  "sourceUrl": "https://github.com/example/tool"
}
```

The manifest URL and entrypoint URL must use HTTPS.

## Server configuration

Generate an administrator token:

```bash
openssl rand -hex 32
```

Add it to `.env`:

```env
PLUGIN_ADMIN_TOKEN=<generated-value>
```

Then rebuild:

```bash
docker compose up -d --build
```

Open:

```text
https://portal.cohvera.be/admin/plugins
```

The token is entered in the admin screen and stored only in browser `sessionStorage` for the active tab/session.

## Architecture decision

Executing downloaded arbitrary backend code inside the Portal process is deliberately not supported. That model would allow one plugin to break the complete portal and conflicts with Cohvera's plugin isolation requirement.

External plugins are therefore isolated applications. A later runtime can add signed package catalogs, container orchestration and automated upgrades without changing the core plugin contract.

## Acceptance criteria

- Existing built-in plugins appear in Plugin Manager.
- Admin can activate/deactivate a plugin independently for each company.
- Admin can install an external plugin from a valid HTTPS manifest.
- Invalid manifests and HTTP URLs are rejected.
- External plugins can be uninstalled.
- Built-in plugins cannot be uninstalled.
- Admin mutations require `PLUGIN_ADMIN_TOKEN`.
- Existing tools and COEF hubs remain independent from plugin administration.
