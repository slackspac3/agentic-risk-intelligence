'use strict';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderList(items = [], emptyLabel = 'None.') {
  return Array.isArray(items) && items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
}

function renderRisks(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="muted">No shortlisted risks returned for this run.</p>';
  }
  return items.map((item) => `
    <article class="result-risk">
      <strong>${escapeHtml(item.title || 'Untitled risk')}</strong>
      <span>${escapeHtml(item.category || '')}</span>
      <p>${escapeHtml(item.description || '')}</p>
    </article>
  `).join('');
}

function renderActivity(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="muted">No agent activity was recorded.</p>';
  }
  return items.map((item) => `
    <article class="result-step">
      <div class="result-step__head">
        <span class="status-pill status-pill--${escapeHtml(item.status || 'pending')}">${escapeHtml(item.status || 'pending')}</span>
        <strong>${escapeHtml(item.title || 'Untitled step')}</strong>
      </div>
      <p>${escapeHtml(item.detail || '')}</p>
    </article>
  `).join('');
}

function setRuntimeMode(mode = 'unknown', remoteConfigured = false) {
  const runtimeChip = document.getElementById('runtime-chip');
  const runtimePill = document.getElementById('runtime-pill');
  const runtimeModeLabel = mode === 'mock' ? 'Mock runtime' : 'Remote gateway';
  const runtimeDetail = mode === 'mock'
    ? 'Deterministic local outputs. No live provider dependency is required to test the interface or the agent loop.'
    : (remoteConfigured
      ? 'Hosted gateway mode is configured. Local requests can be routed to a deployed API boundary for live model work.'
      : 'Remote mode is selected, but no hosted gateway is configured yet.');

  runtimeChip.textContent = runtimeModeLabel;
  runtimePill.textContent = mode === 'mock' ? 'Local mock' : 'Gateway';
  runtimeChip.dataset.mode = mode;
  runtimePill.dataset.mode = mode;
  document.getElementById('runtime-detail').textContent = runtimeDetail;
}

async function loadRuntime() {
  const response = await fetch('/api/config');
  const payload = await response.json();
  const mode = payload?.config?.mode || 'unknown';
  const remoteConfigured = Boolean(payload?.config?.remoteApiConfigured);
  setRuntimeMode(mode, remoteConfigured);
}

function renderResult(result) {
  const summary = result?.summary || {};
  const outputs = result?.outputs || {};
  const draft = outputs.draft || {};
  const challenge = outputs.challenge || {};
  const runtimeStatus = result?.runtimeStatus || {};

  return `
    <section class="result-hero">
      <div>
        <p class="section-kicker">Assessment Summary</p>
        <h3>${escapeHtml(summary.scenarioLens?.label || 'Unclassified scenario')}</h3>
        <p class="result-hero__narrative">${escapeHtml(summary.draftNarrative || 'No draft narrative returned.')}</p>
      </div>
      <div class="result-metrics">
        <article>
          <span class="card-label">Runtime</span>
          <strong>${escapeHtml(runtimeStatus.mode || result.mode || 'unknown')}</strong>
        </article>
        <article>
          <span class="card-label">Draft source</span>
          <strong>${escapeHtml(draft.draftNarrativeSource || draft.mode || 'agent')}</strong>
        </article>
        <article>
          <span class="card-label">Challenge</span>
          <strong>${challenge.challengeQuestions?.length || 0} open prompts</strong>
        </article>
      </div>
    </section>

    <section class="result-grid">
      <article class="result-panel">
        <span class="card-label">Agent Activity</span>
        ${renderActivity(result.activity)}
      </article>
      <article class="result-panel">
        <span class="card-label">Critique</span>
        <p class="result-panel__copy">${escapeHtml(summary.critiqueSummary || 'No critique summary returned.')}</p>
        <span class="card-label">Clarifying Questions</span>
        ${renderList(summary.clarifyingQuestions, 'No clarifying questions were returned.')}
      </article>
    </section>

    <section class="result-grid result-grid--detail">
      <article class="result-panel">
        <span class="card-label">Shortlisted Risks</span>
        <div class="result-risk-list">${renderRisks(draft.risks)}</div>
      </article>
      <article class="result-panel">
        <span class="card-label">Challenge Questions</span>
        ${renderList(challenge.challengeQuestions, 'No challenge questions were returned.')}
        <span class="card-label">Trace Labels</span>
        <ul>
          <li>${escapeHtml(draft.trace?.label || 'No draft trace label')}</li>
          <li>${escapeHtml(challenge.trace?.label || 'No challenge trace label')}</li>
        </ul>
      </article>
    </section>
  `;
}

function fillPrompt(text = '') {
  const input = document.getElementById('risk-statement');
  input.value = text;
  input.focus();
}

async function runAgent(event) {
  event.preventDefault();
  const runButton = document.getElementById('run-agent');
  const resultsPanel = document.getElementById('results-panel');

  runButton.disabled = true;
  runButton.textContent = 'Running…';
  resultsPanel.innerHTML = `
    <div class="workspace-loading">
      <div class="workspace-loading__pulse"></div>
      <p>The agent is checking runtime mode, drafting the scenario, and running a challenge pass.</p>
    </div>
  `;

  const payload = {
    riskStatement: document.getElementById('risk-statement').value,
    businessUnit: document.getElementById('business-unit').value,
    geography: document.getElementById('geography').value
  };

  try {
    const response = await fetch('/api/agent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || result.message || 'Agent run failed.');
    }
    resultsPanel.innerHTML = renderResult(result);
  } catch (error) {
    resultsPanel.innerHTML = `
      <div class="workspace-error">
        <span class="card-label">Run failed</span>
        <p>${escapeHtml(error.message || 'Unknown error')}</p>
      </div>
    `;
  } finally {
    runButton.disabled = false;
    runButton.textContent = 'Run Assessment Agent';
  }
}

document.getElementById('agent-form').addEventListener('submit', runAgent);
document.querySelectorAll('[data-prompt-fill]').forEach((button) => {
  button.addEventListener('click', () => {
    fillPrompt(button.getAttribute('data-prompt-fill') || '');
  });
});

loadRuntime().catch((error) => {
  const message = error?.message || 'Failed to load runtime details.';
  document.getElementById('runtime-chip').textContent = 'Runtime error';
  document.getElementById('runtime-pill').textContent = 'Error';
  document.getElementById('runtime-detail').textContent = message;
});
