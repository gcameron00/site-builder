# Architecture

## Overview

Site-builder is a Cloudflare Pages app. The frontend is a static HTML form. The backend is a Cloudflare Pages Function (the orchestrator) that calls the GitHub and Cloudflare APIs in sequence to spin up a new site. Claude Code is triggered via a GitHub Issue on the new repo and handles generating the initial content.

## Request flow

### 1. User submits the form

The UI sends a POST to `/api/create` with:
```json
{ "name": "my-project", "description": "A site about..." }
```

### 2. Orchestrator: create GitHub repo

Calls the GitHub API to generate a new repo from the template:
```
POST /repos/{template_owner}/{template_repo}/generate
```
Payload: `{ "name": "my-project", "private": false }`

The new repo is created with the template contents including both GitHub Actions workflows.

### 3. Orchestrator: create Cloudflare Pages project

Calls the Cloudflare API to create a Pages project connected to the new repo:
```
POST /accounts/{account_id}/pages/projects
```
Because the new repo is under the same GitHub account that CF is already connected to, no additional OAuth step is needed.

The resulting Pages URL follows the pattern: `my-project.pages.dev`

### 4. Orchestrator: set secrets on new repo

Secrets don't copy from the template, so the orchestrator sets two secrets explicitly.

For each secret:
1. Fetch the repo's public key:
   ```
   GET /repos/{owner}/my-project/actions/public-key
   ```
2. Encrypt the value using libsodium with that public key
3. Store it:
   ```
   PUT /repos/{owner}/my-project/actions/secrets/{SECRET_NAME}
   ```

| Secret | Value | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | Powers Claude Code |
| `GH_PAT` | Same value as `GITHUB_TOKEN` | Passed to `claude-code-action` so Claude's git push uses a PAT rather than `GITHUB_TOKEN` — this allows the push to cascade and trigger `auto-merge.yml`. GitHub suppresses workflow triggers for events caused by `GITHUB_TOKEN`. |

### 5. Orchestrator: create a GitHub issue

Opens an issue on the new repo that triggers Claude Code:
```
POST /repos/{owner}/my-project/issues
```
Payload:
```json
{
  "title": "Initial site build",
  "body": "@claude Please build out this website. The project description is:\n\n{description}\n\nUpdate index.html with a fitting title, headline, and introductory content. Update about/index.html with relevant background. Keep the existing HTML structure and CSS — only change the content.",
  "labels": ["enhancement"]
}
```

### 6. Claude Code processes the issue

The `claude.yml` workflow in the repo (copied from the template) is listening for new issues. It:
- Runs the Claude Code GitHub Action
- Claude reads the issue, edits the site files
- Opens a pull request with the changes against main

### 7. Auto-merge merges the PR

The `auto-merge.yml` workflow triggers when a PR is opened by the Claude bot. It automatically merges the PR into main without requiring manual review.

### 8. Cloudflare Pages deploys

The merge to main triggers a CF Pages build. The site goes live at `my-project.pages.dev`.

### 9. Response to user

The orchestrator returns the Pages URL immediately after step 3 — before Claude Code has run. The URL is predictable (`{name}.pages.dev`). The user is shown the URL with a note that content will appear within a few minutes.

---

## Template repo: `generic-website`

The template repo (`gcameron00/generic-website`) must contain:

| File | Purpose |
|---|---|
| `.github/workflows/claude.yml` | Standard Claude Code action — triggers on issues mentioning `@claude` |
| `.github/workflows/auto-merge.yml` | Auto-merges PRs opened by the Claude bot |
| `index.html`, `about/index.html`, etc. | Base site files Claude Code will update |

### Security
The template repo's issue creation is restricted to collaborators only (GitHub Settings → General → Issues). This prevents the Claude bot being triggered by arbitrary users opening issues on newly-created repos.

---

## Cloudflare Pages Function

Location: `functions/api/create.js`

An edge function running on Cloudflare's network. Has access to environment variables set in the CF Pages dashboard.

**Required environment variables:**

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | `repo` scope — create repos, set secrets, create issues |
| `CLOUDFLARE_API_TOKEN` | Pages write — create projects |
| `CLOUDFLARE_ACCOUNT_ID` | Identifies your CF account |
| `GITHUB_TEMPLATE_OWNER` | e.g. `gcameron00` |
| `GITHUB_TEMPLATE_REPO` | e.g. `generic-website` |
| `ANTHROPIC_API_KEY` | Set as secret on each new repo |

---

## Error handling

- Duplicate repo name → GitHub returns 422 — surface to user as "that name is already taken"
- Duplicate CF Pages project name → same pattern
- Secret encryption failure → log and surface; new repo exists but Claude won't trigger
- Claude Code runs asynchronously — the orchestrator does not wait for it; the UI should communicate that content takes a few minutes to appear

---

## Known constraints

- GitHub secrets require libsodium encryption — the orchestrator needs `libsodium-wrappers` (or equivalent) to encrypt the API key before storing it
- CF Pages project names follow the pattern: repo name lowercased, non-alphanumeric characters replaced by hyphens
- The `enhancement` label is used to gate the Claude trigger — it's a GitHub default label present on every new repo, so no label creation is needed in the template or by the orchestrator
