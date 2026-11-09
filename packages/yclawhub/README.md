# `yclawhub`

YClawHub CLI for private and multi-environment ClawHub deployments.

## Install

```bash
npx @guanghe-pub/clawhub@latest --help
# or
npm i -g @guanghe-pub/clawhub
```

## Environment Management

```bash
yclawhub env add --name staging --site https://staging.example.com --use
yclawhub env add --name prod --site https://skills.example.com
yclawhub env list
yclawhub env use prod
yclawhub env current
```

## Notes

- Global config is isolated under the `yclawhub` application support/config path.
- Workspace metadata is written under `.yclawhub/`.
- Environment variables use the `YCLAWHUB_*` prefix.
