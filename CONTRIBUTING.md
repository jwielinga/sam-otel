# Contributing

## Development

Use nvm to install and select the Node.js version pinned in `.nvmrc`. The supported package runtime range is declared in `package.json`; use pnpm 8.6.12 for development. Install dependencies and run the full quality check before opening a pull request:

```sh
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm check
```

Pull requests should target `main`. The Quality workflow runs formatting, lint, type, test, and build checks. Do not include collector credentials, access tokens, or real user log data in commits, tests, or issues.

## Commit Messages

Use Conventional Commits because semantic-release derives package versions and release notes from commit history:

- `fix: handle empty batch` produces a patch release.
- `feat: add resource attributes` produces a minor release.
- `feat!: change logger configuration` or a `BREAKING CHANGE:` footer produces a major release.

Documentation-only and maintenance changes can use `docs:`, `test:`, `build:`, or `chore:`; those do not publish a release by themselves.
