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

## Phase 3 — Cloudflare Pages Function (orchestrator)
*The backend the form POSTs to. Test with curl before building the UI.*

- [ ] Create `functions/api/create.js`
- [ ] Install `libsodium-wrappers` for encrypting secrets before storing them via the GitHub API
- [ ] On POST `{ name, description }`, in sequence:
  1. GitHub API: create repo from template
  2. Cloudflare API: create Pages project linked to new repo
  3. GitHub API: set `ANTHROPIC_API_KEY` secret on new repo (encrypt with repo's public key first)
  4. GitHub API: set `GH_PAT` secret on new repo (same value — used by claude.yml to create/merge PRs)
  5. GitHub API: create issue on new repo with `@claude` + description + `enhancement` label
  6. Return `{ url: "https://{name}.pages.dev" }`
- [ ] Handle errors: duplicate repo name (422), duplicate CF Pages project name, secret encryption failure
- [ ] Add `ANTHROPIC_API_KEY` to `.dev.vars` and to CF Pages dashboard secrets
- [ ] Set all other env vars in CF Pages dashboard

**Test locally:**
```bash
wrangler pages dev .
curl -X POST http://localhost:8788/api/create \
  -H "Content-Type: application/json" \
  -d '{"name":"test-site","description":"A site about jazz music."}'
```
Verify: repo created on GitHub, CF Pages project created, both secrets set, issue opened, Claude Code triggers, PR created and merged automatically.

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
