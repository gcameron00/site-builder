# Implementation Plan

Build order matters — each phase can be tested independently before the next depends on it.

---

## Phase 1 — Credentials and prerequisites ✅

- [x] Create a GitHub Personal Access Token with `repo` scope (includes secrets management)
- [x] Create a Cloudflare API Token with Pages write permissions
- [x] Note your Cloudflare Account ID
- [x] Confirm you have an Anthropic API key
- [x] Identify the GitHub template repo (`gcameron00/generic-website`)

**Output:** Six values in `.dev.vars` — `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TEMPLATE_OWNER`, `GITHUB_TEMPLATE_REPO`, `ANTHROPIC_API_KEY`. All except `GITHUB_TOKEN` also set as CF Pages production secrets.

---

## Phase 2 — Template repo setup (`generic-website`) ✅

- [x] `.github/workflows/claude.yml` — triggers on issues with `@claude` + `enhancement` label; runs Claude Code then auto-merges the resulting PR
- [x] Security gate: `enhancement` label (collaborators-only) prevents arbitrary users triggering Claude

> **Note:** A separate `auto-merge.yml` was explored and abandoned — GitHub suppresses Actions triggers for events caused by `GITHUB_TOKEN`. The merge step lives inside `claude.yml` itself: polls issue comments for Claude's compare URL, creates a PR via `GH_PAT`, merges it, and the issue auto-closes via `Closes #N` in the PR body.

---

## Phase 3 — Cloudflare Pages Function (orchestrator) ✅

- [x] `functions/api/create.js` — POST `{ name, description }` triggers the full setup sequence
- [x] `tweetsodium` for secret encryption (pure JS; `libsodium-wrappers` rejected at build due to WASM resolution)
- [x] Sequence: create GitHub repo → create CF Pages project → return URL → (background) enable Actions → set secrets → open issue
- [x] CF Pages actual subdomain read from API response (handles name conflicts e.g. `name-7gx.pages.dev`)
- [x] Issue body externalised to `templates/issue-body.md` with `{{description}}` placeholder
- [x] All env vars set in CF Pages dashboard as production secrets

> **Notes:**
> - Secrets endpoint is `/actions/secrets/public-key` (not `/actions/public-key`)
> - `waitUntil` returns the URL immediately; background work retries the secrets endpoint up to 10× until Actions is ready
> - Actions must be explicitly enabled via `PUT /repos/{owner}/{repo}/actions/permissions` — not auto-enabled for API-created repos
> - `ANTHROPIC_API_KEY` must be set as a CF Pages production secret (not just `.dev.vars`) — missing this was the root cause of the first production failure

---

## Phase 4 — Form UI ✅

- [x] `index.html` — project name input, description textarea, submit button
- [x] `main.js` — POSTs to `/api/create`, loading state, success URL link, error messages
- [x] Client-side name validation (lowercase, alphanumeric + hyphens, no leading/trailing hyphens)
- [x] Double-submit prevention while request is in flight
- [x] Success state shows actual CF Pages URL returned by the API

---

## Phase 5 — Polish and edge cases

- [ ] Update `about/index.html` to describe the site-builder itself
- [ ] Consider rate limiting or abuse prevention on `/api/create`
- [ ] Handle CF Pages project name conflicts explicitly (surface the actual URL if CF renames it)

---

## Summary of dependencies

```
Phase 1 (credentials)
    ↓
Phase 2 (template repo: claude.yml with merge step + enhancement label gate)
    ↓
Phase 3 (CF Pages Function orchestrator)
    ↓
Phase 4 (form UI)                         ← end-to-end working ✅
    ↓
Phase 5 (polish)
```
