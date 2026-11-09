---
summary: 'Auth overview: Go backend sessions + GitHub/Feishu auth + API tokens (CLI).'
read_when:
  - Working on login/token flows
  - Debugging 401s
---

# Auth

## Web auth

- Go backend issues the platform session cookie `clawhub_session`.
- Supported interactive providers:
  - GitHub OAuth (compatibility path)
  - Feishu OAuth / H5 login
- Email/password login may also remain enabled if SMTP is configured.

### GitLab

GitLab is not an interactive login provider in the current runtime. The backend only uses GitLab configuration for project read/import:

- `GITLAB_BASE_URL`
- `GITLAB_IMPORT_TOKEN`
- `GITLAB_CA_CERT_FILE`

### GitHub

- Browser entry: `GET /auth/github`
- Callback: `GET /auth/github/callback`
- Required config:
  - `GITHUB_ENABLED=true`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`

Local setup steps are in the repo root `README.md`.

## API tokens (CLI)

The CLI uses a long-lived API token (Bearer token) for publish/sync/delete.

There are two CLI entry points:

- `clawhub`: public/default registry CLI
- `yclawhub`: private registry / multi-environment CLI

### Browser flow (default)

`clawhub login` does:

1. Starts a loopback HTTP server on `127.0.0.1` (random port).
2. Opens `<site>/cli/auth?redirect_uri=http://127.0.0.1:<port>/callback&state=...`.
3. Web UI requires a valid platform login session, then creates a token and redirects back to the loopback server.
4. CLI stores the token in the global config file.

For private registries, the equivalent flow is:

```bash
npx yclawhub@latest login --registry https://registry.yc345.tv
```

Or after global install:

```bash
yclawhub login --registry https://registry.yc345.tv
```

Important:

- The CLI receives a ClawHub API token, not a third-party provider access token.
- This keeps third-party provider tokens on the server side only.

### Headless flow

Create a token in the web UI (Settings → API tokens) and paste it:

```bash
clawhub login --token clh_...
```

For `yclawhub`:

```bash
yclawhub login --registry https://registry.yc345.tv --token clh_...
```

### Token storage

Default global config path:

- macOS: `~/Library/Application Support/clawhub/config.json`

Override:

- `CLAWHUB_CONFIG_PATH=/path/to/config.json`

For `yclawhub`:

- macOS: `~/Library/Application Support/yclawhub/config.json`
- `YCLAWHUB_CONFIG_PATH=/path/to/config.json`
- workspace metadata lives under `.yclawhub/`

### Revocation

- Tokens can be revoked in the web UI.
- Revoked tokens return `401 Unauthorized` on CLI endpoints.
