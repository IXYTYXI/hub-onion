---
summary: 'Common setup/runtime issues (CLI + backend) and fixes.'
read_when:
  - Something is broken and you need a fix-fast checklist
---

# Troubleshooting

## `clawhub login` opens browser but never completes

- Ensure your browser can reach `http://127.0.0.1:<port>/callback` (local firewalls/VPNs can interfere).
- Use headless mode:
  - create a token in the web UI (Settings → API tokens)
  - `clawhub login --token clh_...`

For private registries with `yclawhub`:

- `npx yclawhub@latest login --registry https://registry.yc345.tv`
- headless: `yclawhub login --registry https://registry.yc345.tv --token clh_...`

## `whoami` / `publish` returns `Unauthorized` (401)

- Token missing or revoked: check your config file (`CLAWHUB_CONFIG_PATH` override?).
- Ensure requests include `Authorization: Bearer ...` (CLI does this automatically).

For `yclawhub`, check:

- `YCLAWHUB_CONFIG_PATH`
- `~/Library/Application Support/yclawhub/config.json`
- whether the active environment points at the expected registry

## CLI/API returns `Rate limit exceeded` (429)

- Read headers in the response:
  - `Retry-After` = wait seconds before retry
  - `RateLimit-Remaining` + `RateLimit-Limit` = current budget
  - `RateLimit-Reset` (or `X-RateLimit-Reset`) = reset timing
- The CLI now includes retry hints in 429 errors (retry delay + remaining budget).
- If many users share one egress IP (NAT/proxy), IP limit can be hit even with valid tokens.
- For non-Cloudflare deploys behind trusted proxies, set `TRUST_FORWARDED_IPS=true` so forwarded client IPs can be used.

## `search` / `install` fails with `fetch failed` behind a proxy

If your system requires an HTTP proxy for outbound connections (e.g. corporate
firewalls, Docker containers with proxy-only internet, Hetzner VPS), the CLI
will fail with:

```
✖ fetch failed
Error: fetch failed
```

**Fix:** Set the standard proxy environment variables:

```bash
export HTTPS_PROXY=http://proxy.example.com:3128
clawhub search "my query"
```

The CLI respects `HTTPS_PROXY`, `HTTP_PROXY`, `https_proxy`, and `http_proxy`.

For `yclawhub`, the same proxy setup applies:

```bash
export HTTPS_PROXY=http://proxy.example.com:3128
yclawhub search "my query" --registry https://registry.yc345.tv
```
## `sync` says “No skills found”

- `sync` looks for folders containing `SKILL.md` (or `skill.md`).
- It scans:
  - workdir first
  - then fallback roots (legacy `~/clawdis/skills`, `~/clawdbot/skills`, etc.)
- Provide explicit roots:

```bash
clawhub sync --root /path/to/skills
```

For `yclawhub`, the equivalent is:

```bash
yclawhub sync --root /path/to/skills
```

## `update` refuses due to “local changes (no match)”

- Your local files don’t match any published fingerprint.
- Options:
  - keep local edits; skip updating
  - overwrite: `clawhub update <slug> --force`
  - publish as fork: copy to new folder/slug then `clawhub publish ... --fork-of upstream@version`

## `GET /api/*` works locally but not in production

- Check that the frontend server has `BACKEND_URL` pointing at the Go backend.
- If OG/SSR fetches need an absolute origin, set `API_ORIGIN`.
- Browser API calls should use `VITE_API_BASE` or `VITE_API_ORIGIN`, not legacy Convex variables.
