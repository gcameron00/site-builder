# Implementation Plan

Build order matters — each phase can be tested independently before the next depends on it.

---

## Phase 1 — Credentials and prerequisites
*Nothing else can be tested without these in place.*

- [x] Create a GitHub Personal Access Token with `repo` scope (includes secrets management)
- [x] Create a Cloudflare API Token with Pages write permissions
- [x] Note your Cloudflare Account ID
- [x] Confirm you have an Anthropic API key
- [x] Identify the GitHub template repo (`gcameron00/generic-website`)

**Output:** Five values in `.dev.vars` — `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TEMPLATE_OWNER`, `GITHUB_TEMPLATE_REPO`. Plus `ANTHROPIC_API_KEY` for use in Phase 3.

---

## Phase 2 — Template repo setup (`generic-website`)
*Must be complete before any end-to-end testing.*

- [x] Add `.github/workflows/claude.yml` — standard Claude Code action, triggers on issues mentioning `@claude`
- [ ] Add `.github/workflows/auto-merge.yml` — auto-merges PRs opened by the Claude bot
- [ ] Restrict issue creation to collaborators (Settings → General → Issues → "Collaborators and members")
- [ ] Ensure a `site-builder` label exists in the template repo (used by the orchestrator when opening issues)

**Test (manual):**
1. Create a new repo from the `generic-website` template
2. Add `ANTHROPIC_API_KEY` as a secret on the test repo
3. Open an issue mentioning `@claude` with a site description
4. Verify Claude Code opens a PR with updated content
5. Verify the auto-merge workflow merges the PR automatically

**Dependency:** Phase 1 complete.

---

## Phase 3 — Cloudflare Pages Function (orchestrator)
*The backend the form POSTs to. Test with curl before building the UI.*

- [ ] Create `functions/api/create.js`
- [ ] Install `libsodium-wrappers` for encrypting the Anthropic API key before storing it as a GitHub secret
- [ ] On POST `{ name, description }`, in sequence:
  1. GitHub API: create repo from template
  2. Cloudflare API: create Pages project linked to new repo
  3. GitHub API: set `ANTHROPIC_API_KEY` secret on new repo (encrypt with repo's public key first)
  4. GitHub API: create issue on new repo with `@claude` + description
  5. Return `{ url: "https://{name}.pages.dev" }`
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
Verify: repo created on GitHub, CF Pages project created, secret set, issue opened, Claude Code triggers.

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
Phase 2 (template repo: claude.yml + auto-merge.yml + settings)  ← test: manual issue
    ↓
Phase 3 (CF Pages Function orchestrator)                          ← test: curl
    ↓
Phase 4 (form UI)                                                 ← test: end-to-end browser
    ↓
Phase 5 (polish)
```

## What's done

- Phase 1: complete
- Phase 2: `claude.yml` added and tested successfully; `auto-merge.yml` and repo settings pending
