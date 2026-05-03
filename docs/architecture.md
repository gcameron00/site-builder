# Architecture

## Overview

Site-builder is a Cloudflare Pages app. The frontend is a static HTML form. The backend is a Cloudflare Pages Function that acts as an orchestrator, calling the GitHub and Cloudflare APIs in sequence, then triggering a GitHub Action that runs Claude Code to generate the initial site content.

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

The new repo URL will be `github.com/{owner}/my-project`.

### 3. Orchestrator: create Cloudflare Pages project

Calls the Cloudflare API to create a Pages project connected to the new repo:
```
POST /accounts/{account_id}/pages/projects
```
CF needs GitHub OAuth access to the repo. Because the new repo is under the same GitHub account that CF is already connected to, no additional OAuth step is needed.

The resulting Pages URL follows the pattern: `my-project.pages.dev`

### 4. Orchestrator: trigger GitHub Action

Dispatches a `workflow_dispatch` event on the new repo:
```
POST /repos/{owner}/my-project/actions/workflows/build.yml/dispatches
```
Payload includes the project description as an input, which the workflow passes to Claude Code.

### 5. GitHub Action runs Claude Code

The workflow in the template repo:
- Checks out the new repo
- Runs `claude` CLI with a prompt constructed from the project description
- Claude Code updates the site files
- Commits and pushes the changes

### 6. Cloudflare Pages auto-deploys

The push to the repo triggers a CF Pages build. The site goes live at `my-project.pages.dev`.

### 7. Response to user

The orchestrator returns the Pages URL immediately after step 3. The URL is predictable (`{name}.pages.dev`) so there's no need to poll — the site will be live within a minute or two.

## Cloudflare Pages Function

Location: `functions/api/create.js`

This is an edge function — it runs on Cloudflare's network, not a traditional server. It has access to environment variables set in the CF Pages dashboard.

## Template repo requirements

The GitHub template repo must contain a `.github/workflows/build.yml` workflow file that:
- Accepts a `description` input via `workflow_dispatch`
- Has `ANTHROPIC_API_KEY` available as a secret
- Runs the Claude Code CLI with the description
- Commits and pushes any changes

## Error handling

- If the repo name is already taken on GitHub, the API returns a 422 — surface this to the user.
- CF Pages project names must be unique within your account — same pattern.
- GitHub Actions can take a few minutes. The UI should make clear the site won't be live instantly.

## Known constraints

- CF Pages project names are derived from the GitHub repo name, lowercased, with non-alphanumeric characters replaced by hyphens.
- The `workflow_dispatch` trigger requires the workflow file to already exist on the default branch of the new repo — which it will, since it comes from the template.
- Claude Code in a GitHub Action requires the `claude` npm package and an `ANTHROPIC_API_KEY` secret.
