# Implementation Plan

Build order matters — each phase can be tested independently before the next depends on it.

---

## Phase 1 — Credentials and prerequisites ✅
*Nothing else can be tested without these in place.*

- [x] Create a GitHub Personal Access Token with `repo` scope (includes secrets management)
- [x] Create a Cloudflare API Token with Pages write permissions
- [x] Note your Cloudflare Account ID
- [x] Confirm you have an Anthropic API key
- [x] Identify the GitHub template repo (`gcameron00/generic-website`)

**Output:** Five values in `.dev.vars` — `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TEMPLATE_OWNER`, `GITHUB_TEMPLATE_REPO`. Plus `ANTHROPIC_API_KEY` for use in Phase 3.

---

## Phase 2 — Template repo setup (`generic-website`) ✅
*Must be complete before any end-to-end testing.*

- [x] Add `.github/workflows/claude.yml` — triggers on issues mentioning `@claude` with the `enhancement` label; runs Claude Code, then auto-merges the resulting branch into main
- [x] Security gate: use the `enhancement` label to restrict Claude triggering to collaborators only (only collaborators can apply labels; `enhancement` is a GitHub default so no label creation is needed)

> **Note:** A separate `auto-merge.yml` workflow was explored but abandoned. GitHub suppresses Actions workflow triggers for events caused by `GITHUB_TOKEN`, making a separate merge workflow unreliable. The merge step now lives inside `claude.yml` itself: after Claude Code finishes it polls the issue comments for Claude's compare URL, extracts the branch name, creates a PR via `GH_PAT`, and merges it.

**Test (manual):**
1. Create a new repo from the `generic-website` template
2. Add `ANTHROPIC_API_KEY` and `GH_PAT` as secrets on the test repo
3. Open an issue with `@claude` in the body and the `enhancement` label applied
4. Verify Claude Code pushes a branch and comments on the issue
5. Verify the merge step creates a PR, merges it, and closes the issue

**Dependency:** Phase 1 complete.

---

## Phase 3 — Cloudflare Pages Function (orchestrator) ✅
*The backend the form POSTs to. Test with curl before building the UI.*

- [x] Create `functions/api/create.js`
- [x] Install `tweetsodium` for encrypting secrets (pure JS, works in CF edge runtime — `libsodium-wrappers` was rejected at build time due to WASM file resolution issues)
- [x] On POST `{ name, description }`, in sequence:
  1. GitHub API: create repo from template
  2. Cloudflare API: create Pages project linked to new repo — return URL to caller immediately via `waitUntil`
  3. GitHub API: enable Actions on the new repo (not auto-enabled for API-created repos)
  4. GitHub API: set `ANTHROPIC_API_KEY` secret — retries until Actions secrets endpoint is ready
  5. GitHub API: set `GH_PAT` secret
  6. GitHub API: create issue with `@claude` + description + `enhancement` label
- [x] Handle errors: duplicate repo name (422), secret encryption failure (non-fatal, logged)
- [x] `ANTHROPIC_API_KEY` added to `.dev.vars`

> **Notes:**
> - Correct secrets endpoint is `/actions/secrets/public-key` (not `/actions/public-key`)
> - `waitUntil` is used so the URL is returned immediately; secrets + issue run in the background
> - Actions must be explicitly enabled via `PUT /repos/{owner}/{repo}/actions/permissions` before the secrets API becomes available

**Dependency:** Phase 2 complete.

---

## Phase 4 — Form UI
*Built last — the function is already proven to work.*

- [ ] Update `index.html` with the form: project name field, description textarea, submit button
- [ ] `main.js` handles submit: POST to `/api/create`, show loading state during request
- [ ] On success: display the `.pages.dev` URL as a clickable link with a note that content will appear within a few minutes
- [ ] On error: clear message (e.g. "that project name is already taken")

**Test:** Submit the form end-to-end. Verify repo, CF Pages project, issue, PR, auto-merge, and live site all work in sequence.

**Dependency:** Phase 3 complete.

---

## Phase 5 — Polish and edge cases

- [ ] Client-side validation: project name must be lowercase, alphanumeric + hyphens, no leading/trailing hyphens
- [ ] Prevent double-submit while request is in flight
- [ ] Consider a status note: "Your site is being built — it will be live at {url} in about 2 minutes"
- [ ] Update `about/index.html` if anything changed during the build

---

## Summary of dependencies

```
Phase 1 (credentials)
    ↓
Phase 2 (template repo: claude.yml with merge step + enhancement label gate)  ← test: manual issue
    ↓
Phase 3 (CF Pages Function orchestrator)                                        ← test: curl
    ↓
Phase 4 (form UI)                                                               ← test: end-to-end browser
    ↓
Phase 5 (polish)
```
