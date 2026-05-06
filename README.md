# site-builder

A web app that automates the creation of new websites — from a single form submission to a live Cloudflare Pages deployment, with AI-generated initial content.

## What it does

Fill in a project name and a short description. Site-builder handles everything else:

1. Creates a new GitHub repo from your template
2. Creates a Cloudflare Pages project linked to that repo
3. Sets the Anthropic API key as a secret on the new repo
4. Opens a GitHub issue mentioning `@claude` with the project description
5. Claude Code processes the issue, updates the site content, and opens a pull request
6. The PR is automatically merged — triggering a Cloudflare Pages deployment
7. Returns the live `.pages.dev` URL

## Architecture

```
Site-builder UI (CF Pages)
    ↓ POST { name, description }
CF Pages Function (orchestrator)
    ↓ 1. GitHub API → create repo from template
    ↓ 2. Cloudflare API → create Pages project linked to repo
    ↓ 3. GitHub API → set ANTHROPIC_API_KEY secret on new repo
    ↓ 4. GitHub API → open issue with @claude + description
         ↓
    claude.yml workflow triggers
        → Claude Code reads issue, edits site files, opens PR
         ↓
    auto-merge.yml workflow triggers
        → merges PR automatically
         ↓
    Cloudflare Pages detects push to main → deploys site

orchestrator returns → { url: "new-project.pages.dev" }
```

Content appears at the URL within a few minutes of form submission.

## Template repo

New sites are generated from `gcameron00/generic-website`. That repo must contain:

| File | Purpose |
|---|---|
| `.github/workflows/claude.yml` | Triggers Claude Code on issues mentioning `@claude` |
| `.github/workflows/auto-merge.yml` | Auto-merges PRs opened by the Claude bot |

Issue creation on all generated repos is restricted to collaborators to prevent unauthorised use.

## Prerequisites

| Requirement | Purpose |
|---|---|
| GitHub Personal Access Token | `repo` scope — create repos, manage secrets, open issues |
| Cloudflare API Token | Pages write — create projects |
| Cloudflare Account ID | Identifies your CF account |
| Anthropic API Key | Set as a secret on each new repo for Claude Code |

## Environment variables

**Cloudflare Pages Function** (set in CF Pages dashboard as secrets):
```
GITHUB_TOKEN=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
GITHUB_TEMPLATE_OWNER=
GITHUB_TEMPLATE_REPO=
ANTHROPIC_API_KEY=
```

**Local development** (`.dev.vars` — gitignored):
```
GITHUB_TOKEN=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
GITHUB_TEMPLATE_OWNER=
GITHUB_TEMPLATE_REPO=
ANTHROPIC_API_KEY=
```

## Development

```bash
npm install -g wrangler
wrangler pages dev .
```

## Project structure

```
site-builder/
├── index.html                  # Form UI
├── about/
│   └── index.html              # About page
├── functions/
│   └── api/
│       └── create.js           # CF Pages Function — orchestrator
├── assets/
│   ├── css/styles.css
│   ├── js/main.js
│   └── favicon.svg
└── docs/
    ├── architecture.md         # Detailed technical notes
    └── implementation-plan.md  # Build order and progress
```
