# Website building automation  
[Automating website creation with GitHub and CloudFlare Pages](https://claude.ai/share/07462ff7-4db6-4641-9cd0-517d5958a275)  
  
I‘ve been creating website using Claude Code, starting with a basic repo which comes from a template in GitHub. These are then linked to CloudFlare Pages.  
Often I start the website with a a few paras of text.  
Can I automate this initial process, maybe from a website?  
So can I have a site-builder site that take the name of a project and an initial para of text and this is used to trigger the following.  
1. A new repo in GitHub from my template based on the the project name.  
2. A new Pages instance in CF linked to the new repo.  
3. Claude Code is passed the para of project description and, maybe with some wrapper header and footer, starts updating the repo, committing and pushing the update. This will trigger the deployment back to CF.  
The user should be returned on the site-builder site with the URL of the website that CF has chosen. Something like new-project.pages.dev.  
Is all the automation possible?  
  
Show more  
17:29  
  
  
Claude responded: Yes, this is all automatable!  
Yes, this is all automatable! Let me break down what's feasible and where the friction points are.  
**Short answer: Yes, steps 1 and 2 are straightforward. Step 3 is possible but needs a specific approach.**  
**Step 1: GitHub repo from template **✅** Easy**  
The GitHub API has a direct endpoint for this:  
  
  
POST /repos/{template_owner}/{template_repo}/generate  
You pass the new repo name, description, and it creates a fresh copy. This is a single API call with a GitHub token.  
**Step 2: Cloudflare Pages linked to GitHub **✅** Possible**  
The Cloudflare API supports creating Pages projects and connecting them to GitHub repos. You'll need a CF API token and your Account ID. The tricky part is the GitHub OAuth connection — CF needs permission to access the repo. If your CF account already has GitHub connected (which it likely does since you're doing this manually), new repos under the same account are accessible automatically.  
**Step 3: Claude Code triggered remotely **⚠️** Needs thought**  
This is where it gets interesting. Claude Code is a CLI tool, so you need something to *run* it. Your options:  
**Option A: A server/VPS runs Claude Code** A small Node or Python server receives the webhook, then shells out to claude CLI with your prompt. It commits and pushes. Simple and reliable.  
**Option B: GitHub Actions runs Claude Code** Trigger a workflow on repo creation. The action runs claude CLI using the ++[Claude Code GitHub Action](https://github.com/anthropics/claude-code-action)++. This keeps everything in GitHub's infrastructure.  
**Option C: Cloudflare Worker as the orchestrator** Your site-builder is itself a CF Worker/Pages Function that calls the GitHub API, CF API, and then triggers a GitHub Action — no separate server needed.  
**Recommended Architecture**  
  
  
Site-builder UI (CF Pages)  
    ↓ POST {name, description}  
CF Pages Function (orchestrator)  
    ↓ 1. GitHub API → create repo from template  
    ↓ 2. CF API → create Pages project linked to repo    
    ↓ 3. GitHub API → trigger workflow dispatch  
      
GitHub Action (in your template repo)  
    → runs Claude Code CLI with the description  
    → commits + pushes  
    → CF Pages auto-deploys  
      
orchestrator returns → {url: "new-project.pages.dev"}  
**Key Prerequisites**  
* GitHub Personal Access Token (with repo and workflow scopes)  
* Cloudflare API Token (with Pages write permissions)  
* Anthropic API key (for Claude Code in the action)  
* Your template repo must have the GitHub Actions workflow already in it  
**The One Catch**  
CF Pages takes a moment to register the new project and get a URL assigned. You may need to poll the CF API for a few seconds after creation to get the final .pages.dev URL, or return it optimistically since it follows the pattern {project-name}.pages.dev.  
  
Want me to build the site-builder web app? I can create the full thing — the UI form, the CF Pages Function orchestration logic, and the GitHub Actions workflow file you'd add to your template repo.  
  
  
