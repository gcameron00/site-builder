# site-builder

A web app that automates the creation of new websites — from a single form submission to a live Cloudflare Pages deployment, with AI-generated initial content.

## What it does

Fill in a project name and a short description. Site-builder handles everything else:

1. Creates a new GitHub repo from your template
2. Creates a Cloudflare Pages project linked to that repo
3. Triggers a GitHub Actions workflow that runs Claude Code to generate the initial site content, commits it, and pushes
4. Returns the live `.pages.dev` URL

## Architecture

```
Site-builder UI (CF Pages)
    ↓ POST { name, description }
CF Pages Function (orchestrator)
    ↓ 1. GitHub API → create repo from template
    ↓ 2. Cloudflare API → create Pages project linked to repo
    ↓ 3. GitHub API → trigger workflow_dispatch event
         ↓
    GitHub Action (in template repo)
        → runs Claude Code CLI with the description
        → commits + pushes
        → CF Pages auto-deploys
orchestrator returns → { url: "new-project.pages.dev" }
```

## Prerequisites

| Requirement | Purpose |
|---|---|
| GitHub Personal Access Token | `repo` + `workflow` scopes — create repos and trigger actions |
| Cloudflare API Token | Pages write permissions — create projects |
| Cloudflare Account ID | Identifies your CF account |
| Anthropic API Key | Powers Claude Code in the GitHub Action |
| GitHub template repo | The base repo new sites are generated from — must include the workflow file |

## Environment variables

These are set as secrets in Cloudflare Pages (for the orchestrator function) and as repository secrets in your template repo (for the GitHub Action).

**Cloudflare Pages Function:**
```
GITHUB_TOKEN=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
GITHUB_TEMPLATE_OWNER=
GITHUB_TEMPLATE_REPO=
```

**GitHub Actions (in template repo):**
```
ANTHROPIC_API_KEY=
```

## Development

This project is a static site with Cloudflare Pages Functions for the backend. To develop locally:

```bash
npm install -g wrangler
wrangler pages dev .
```

## Project structure

```
site-builder/
├── index.html              # Main form UI
├── about/
│   └── index.html          # About page
├── functions/
│   └── api/
│       └── create.js       # CF Pages Function — orchestrates repo + Pages creation
├── assets/
│   ├── css/styles.css
│   ├── js/main.js
│   └── favicon.svg
└── docs/
    └── architecture.md     # Detailed technical notes
```
