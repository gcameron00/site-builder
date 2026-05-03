# Implementation Plan

Build order matters here — each phase can be tested independently before the next depends on it.

---

## Phase 1 — Credentials and prerequisites
*Nothing else can be tested without these in place.*

- [ ] Create a GitHub Personal Access Token with `repo` and `workflow` scopes
- [ ] Create a Cloudflare API Token with Pages write permissions
- [ ] Note your Cloudflare Account ID (available in the CF dashboard sidebar)
- [ ] Confirm you have an Anthropic API key
- [ ] Identify (or create) the GitHub template repo that new sites will be generated from

**Output:** Five values in hand — `GITHUB_TOKEN`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, and `{template_owner}/{template_repo}`.

---

## Phase 2 — GitHub Actions workflow in the template repo
*The CF Pages Function will trigger this workflow. It must exist before the orchestrator can be tested end-to-end.*

- [ ] Add `.github/workflows/build.yml` to the template repo
- [ ] Workflow accepts a `description` string as a `workflow_dispatch` input
- [ ] Workflow installs and runs Claude Code CLI with the description as the prompt
- [ ] Claude Code updates site files; workflow commits and pushes the result
- [ ] Add `ANTHROPIC_API_KEY` as a secret on the template repo
- [ ] **Test:** Trigger the workflow manually from the GitHub Actions UI with a sample description. Verify Claude Code commits content to the repo.

**Dependency:** Phase 1 complete.

---

## Phase 3 — Cloudflare Pages Function (orchestrator)
*The backend that the form will POST to. Can be built and tested with curl before the UI exists.*

- [ ] Create `functions/api/create.js` in this repo
- [ ] On POST `{ name, description }`:
  - Call GitHub API to create repo from template
  - Call Cloudflare API to create Pages project linked to new repo
  - Call GitHub API to dispatch `workflow_dispatch` on `build.yml` with `description`
  - Return `{ url: "https://{name}.pages.dev" }`
- [ ] Handle error cases: duplicate repo name (GitHub 422), duplicate Pages project name (CF conflict)
- [ ] Set environment variables in CF Pages dashboard: `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TEMPLATE_OWNER`, `GITHUB_TEMPLATE_REPO`
- [ ] **Test locally:** `wrangler pages dev .` then `curl -X POST /api/create -d '{"name":"test-site","description":"A test."}'`
- [ ] **Test deployed:** Push to this repo, trigger via curl against the live function URL

**Dependency:** Phase 2 complete (so the triggered workflow actually does something testable).

---

## Phase 4 — Form UI
*The user-facing interface. Built last because the function is already proven to work.*

- [ ] Update `index.html` with the form: project name field, description textarea, submit button
- [ ] `main.js` handles the form submit: POST to `/api/create`, show a loading state
- [ ] On success: display the returned `.pages.dev` URL as a clickable link with a note that the site will be live within ~2 minutes
- [ ] On error: display a clear message (e.g. "that project name is already taken")
- [ ] **Test:** Submit the form end-to-end. Verify the new repo appears on GitHub, the CF Pages project is created, and the site goes live at the returned URL.

**Dependency:** Phase 3 complete.

---

## Phase 5 — Polish and edge cases
*After the happy path is working.*

- [ ] Validate the project name on the client (lowercase, alphanumeric + hyphens only, no leading/trailing hyphens) — CF Pages and GitHub have naming constraints
- [ ] Prevent double-submit while the request is in flight
- [ ] Consider whether to show build progress (CF Pages webhook or just tell users to wait)
- [ ] Update `about/index.html` if anything about the flow changed during build

---

## Summary of dependencies

```
Phase 1 (credentials)
    ↓
Phase 2 (template repo + workflow)  ← test: manual workflow_dispatch
    ↓
Phase 3 (CF Pages Function)         ← test: curl
    ↓
Phase 4 (form UI)                   ← test: end-to-end in browser
    ↓
Phase 5 (polish)
```
