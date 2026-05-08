const form = document.getElementById('create-form');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');

// Lowercase letters, numbers, hyphens; no leading/trailing hyphens
const NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function showStatus(html, type) {
  statusEl.innerHTML = html;
  statusEl.className = `status status--${type}`;
  statusEl.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!NAME_RE.test(name)) {
    showStatus('Project name must use lowercase letters, numbers, and hyphens only — no leading or trailing hyphens.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';
  statusEl.hidden = true;

  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error ?? 'Something went wrong — please try again.', 'error');
      return;
    }

    form.reset();
    showStatus(
      `Your site is being built. It will be live at <a href="${data.url}" target="_blank" rel="noopener">${data.url}</a> in about 2 minutes.`,
      'success'
    );
  } catch {
    showStatus('Could not reach the server — please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create site';
  }
});
