# Release Setup

Releases are created by semantic-release after a quality check on `main`. Conventional Commit messages determine the next version. The release workflow publishes `sam-otel` to npm through GitHub Actions Trusted Publishing; it does not use a stored npm token. semantic-release updates package version metadata, then invokes npm CLI directly for publication because the semantic-release npm plugin's token verification is not OIDC-compatible.

## One-Time Setup

1. Create the public GitHub repository named `sam-otel` under its intended owner. The `origin` remote and the `repository` field in `package.json` already point at `https://github.com/jwielinga/sam-otel.git`; change both if the owner differs.
2. Claim the unscoped npm package name `sam-otel` before another publisher does. At setup time, `npm view sam-otel` returned `E404`, indicating no public package was registered.
3. In the npm package settings, add a GitHub Actions Trusted Publisher for the repository owner, repository `sam-otel`, and workflow `.github/workflows/release.yml`. Do not create an `NPM_TOKEN` secret. The release job uses the Node version pinned in `.nvmrc` and npm 12.1.0, which support npm Trusted Publishing and provenance.
4. Set the repository's default branch to `main`. Under Settings > Actions > General, restrict workflow permissions to read-only by default and allow only the actions this project uses.
5. Add a branch ruleset for `main`: require pull requests, require the `Quality / quality` status check, block force pushes and branch deletion, and prevent bypass where practical. Require at least one approval when another maintainer is available.
6. Enable private vulnerability reporting, secret scanning and push protection, Dependabot alerts, and Dependabot security updates in repository settings. Confirm workflow files and `SECURITY.md` are visible after the repository becomes public.

## Release Behavior

The release workflow runs only on pushes to `main` and waits for the reusable Quality workflow. A `fix:` commit triggers a patch release; `feat:` triggers a minor release; a breaking-change marker triggers a major release. Commits with other types do not release. Do not manually edit `package.json`'s version; semantic-release owns published versions and Git tags.

The first release has no prior semantic-release tag to use as a baseline, so review the existing Conventional Commit history before merging the first release-triggering change. Keep `main` protected so unreviewed changes cannot alter the publishing workflow.

## Pull Request Security

The Quality workflow uses `pull_request`, requests only `contents: read`, and disables persisted checkout credentials. It does not reference repository secrets; fork pull requests do not receive secrets. Do not add repository-level secrets: contributors with write access can change workflow files in same-repository pull requests. If a future workflow needs credentials, use a protected environment with required reviewers. The release workflow is the only workflow with `id-token: write`, and it runs only from `main`; never move that permission to a pull-request workflow or use `pull_request_target` to execute contributor code.
