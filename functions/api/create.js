import * as sodium from 'tweetsodium';

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, description } = body;
  if (!name || !description) {
    return json({ error: 'name and description are required' }, 400);
  }

  const owner = env.GITHUB_TEMPLATE_OWNER;
  const templateRepo = env.GITHUB_TEMPLATE_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const cfToken = env.CLOUDFLARE_API_TOKEN;
  const cfAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  // 1. Create GitHub repo from template
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${templateRepo}/generate`,
    {
      method: 'POST',
      headers: githubHeaders(ghToken),
      body: JSON.stringify({ owner, name, private: false }),
    }
  );

  if (repoRes.status === 422) {
    return json({ error: 'That project name is already taken' }, 422);
  }
  if (!repoRes.ok) {
    return json({ error: `Failed to create repo: ${await repoRes.text()}` }, 500);
  }

  // 2. Create Cloudflare Pages project linked to the new repo
  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        production_branch: 'main',
        source: {
          type: 'github',
          config: {
            owner,
            repo_name: name,
            production_branch: 'main',
            pr_comments_enabled: false,
            deployments_enabled: true,
          },
        },
      }),
    }
  );

  if (!cfRes.ok) {
    const err = await cfRes.json();
    const msg = err?.errors?.[0]?.message ?? 'Unknown error';
    return json({ error: `Failed to create Cloudflare Pages project: ${msg}` }, 500);
  }

  const cfData = await cfRes.json();
  const subdomain = cfData?.result?.subdomain;
  const siteUrl = subdomain ? `https://${subdomain}` : `https://${name}.pages.dev`;

  // Render the issue body from the template file
  const issueBody = await renderIssueBody(env.ASSETS, request.url, description);

  // Return the URL to the caller immediately.
  // Secrets and issue creation run in the background — they need the repo's
  // Actions API to be ready which can take 10–30s after template generation.
  waitUntil(setupRepo({ owner, name, ghToken, anthropicKey, issueBody }));

  return json({ url: siteUrl });
}

async function renderIssueBody(assets, requestUrl, description) {
  const fallback = `@claude Please build out this website. The project description is:\n\n${description}\n\nUpdate index.html with a fitting title, headline, and introductory content. Update about/index.html with relevant background. Keep the existing HTML structure and CSS — only change the content.`;
  try {
    const url = new URL('/templates/issue-body.md', requestUrl);
    const res = await assets.fetch(new Request(url.toString()));
    if (!res.ok) return fallback;
    const template = await res.text();
    return template.replace('{{description}}', description);
  } catch {
    return fallback;
  }
}

async function setupRepo({ owner, name, ghToken, anthropicKey, issueBody }) {
  console.log(`[setupRepo] start — repo: ${owner}/${name}`);

  // GitHub doesn't auto-enable Actions on repos created via API — do it explicitly
  const actionsRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/actions/permissions`,
    {
      method: 'PUT',
      headers: githubHeaders(ghToken),
      body: JSON.stringify({ enabled: true, allowed_actions: 'all' }),
    }
  );
  console.log(`[setupRepo] Actions permissions: ${actionsRes.status}`);

  try {
    await setRepoSecret(owner, name, ghToken, 'ANTHROPIC_API_KEY', anthropicKey);
    await setRepoSecret(owner, name, ghToken, 'GH_PAT', ghToken);
  } catch (err) {
    console.error(`[setupRepo] Failed to set repo secrets: ${err.message}`);
    return;
  }

  console.log(`[setupRepo] secrets set — creating issue`);

  const issueRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/issues`,
    {
      method: 'POST',
      headers: githubHeaders(ghToken),
      body: JSON.stringify({
        title: 'Initial site build',
        body: issueBody,
        labels: ['enhancement'],
      }),
    }
  );

  if (!issueRes.ok) {
    console.error(`[setupRepo] Failed to create issue: ${await issueRes.text()}`);
  } else {
    console.log(`[setupRepo] issue created — done`);
  }
}

// Retries until the repo's Actions public key endpoint is available (can take
// 10–30s after a template repo is generated).
async function setRepoSecret(owner, repo, token, secretName, secretValue, maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const keyRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
      { headers: githubHeaders(token) }
    );

    if (keyRes.status === 404 && attempt < maxAttempts) {
      console.log(`[${secretName}] public key not ready, attempt ${attempt}/${maxAttempts} — retrying in 5s`);
      await sleep(5000);
      continue;
    }
    if (!keyRes.ok) {
      throw new Error(`Could not fetch public key: ${await keyRes.text()}`);
    }

    const { key, key_id } = await keyRes.json();
    const encrypted = sodium.seal(Buffer.from(secretValue, 'utf8'), Buffer.from(key, 'base64'));
    const encryptedValue = Buffer.from(encrypted).toString('base64');

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: 'PUT',
        headers: githubHeaders(token),
        body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
      }
    );
    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      throw new Error(`Could not set secret ${secretName}: ${await putRes.text()}`);
    }

    console.log(`Set secret ${secretName}`);
    return;
  }

  throw new Error(`Public key still not available after ${maxAttempts} attempts`);
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'site-builder',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
