'use strict';

let loadingTimer = null;
let loadingStep = 0;

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
    : `<p class="feed-muted">${escapeHtml(emptyLabel)}</p>`;
}

function renderRiskTokens(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="feed-muted">No shortlist was returned for this run.</p>';
  }
  return items.map((item) => `
    <article class="risk-token">
      <strong>${escapeHtml(item.title || 'Untitled risk')}</strong>
      <span>${escapeHtml(item.category || '')}</span>
      <p>${escapeHtml(item.description || '')}</p>
    </article>
  `).join('');
}

function renderTimeline(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="feed-muted">No timeline steps were returned.</p>';
  }
  return items.map((item, index) => `
    <article class="timeline-step">
      <div class="timeline-step__index">${escapeHtml(String(index + 1).padStart(2, '0'))}</div>
      <div class="timeline-step__body">
        <div class="timeline-step__meta">
          <span class="mini-chip mini-chip--${escapeHtml(item.status || 'pending')}">${escapeHtml(item.status || 'pending')}</span>
          <strong>${escapeHtml(item.title || 'Untitled step')}</strong>
        </div>
        <p>${escapeHtml(item.detail || '')}</p>
      </div>
    </article>
  `).join('');
}

function setRuntimeMode(mode = 'unknown', remoteConfigured = false) {
  const runtimeChip = document.getElementById('runtime-chip');
  const providerChip = document.getElementById('provider-chip');
  const runtimeMode = document.getElementById('runtime-mode');
  const runtimeDetail = document.getElementById('runtime-detail');
  const chipLabel = mode === 'mock' ? 'Mock mode' : 'Live boundary';
  const providerLabel = mode === 'mock' ? 'Deterministic preview' : 'Compass connected';
  const detail = mode === 'mock'
    ? 'Deterministic local outputs. Great for interaction design and safe end-to-end testing.'
    : (remoteConfigured
      ? 'Hosted serverless routes are configured for live model work.'
      : 'Remote mode selected, but the live provider boundary is not fully configured.');

  runtimeChip.textContent = chipLabel;
  providerChip.textContent = providerLabel;
  runtimeChip.dataset.mode = mode;
  providerChip.dataset.mode = mode;
  runtimeMode.textContent = chipLabel;
  runtimeDetail.textContent = detail;
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
  const approvalQuestions = summary.clarifyingQuestions || [];

  return `
    <section class="feed-block feed-block--hero">
      <div class="feed-block__header">
        <div>
          <p class="micro-label">Mission synthesis</p>
          <h2>${escapeHtml(summary.scenarioLens?.label || 'Unclassified scenario')}</h2>
        </div>
        <div class="hero-metrics">
          <span class="status-chip status-chip--tight">${escapeHtml(runtimeStatus.mode || result.mode || 'unknown')}</span>
          <span class="status-chip status-chip--tight status-chip--ghost">${escapeHtml(draft.draftNarrativeSource || draft.mode || 'agent')}</span>
        </div>
      </div>

      <p class="hero-narrative">${escapeHtml(summary.draftNarrative || 'No narrative returned.')}</p>
    </section>

    <section class="feed-duo">
      <article class="feed-block">
        <p class="micro-label">Agent timeline</p>
        <h3>Run trace</h3>
        <div class="timeline">${renderTimeline(result.activity)}</div>
      </article>

      <article class="feed-block">
        <p class="micro-label">Challenge output</p>
        <h3>Pressure test</h3>
        <p class="feed-copy">${escapeHtml(summary.critiqueSummary || 'No critique summary returned.')}</p>
        <div class="challenge-list">
          ${renderList(challenge.challengeQuestions, 'No challenge questions were returned.')}
        </div>
      </article>
    </section>

    <section class="feed-duo">
      <article class="feed-block">
        <p class="micro-label">Shortlisted risk themes</p>
        <h3>What the agent kept in scope</h3>
        <div class="risk-grid">${renderRiskTokens(draft.risks)}</div>
      </article>

      <article class="feed-block">
        <p class="micro-label">Approval gate</p>
        <h3>What still needs you</h3>
        <div class="approval-list">
          ${renderList(approvalQuestions, 'The current run did not return any operator questions.')}
        </div>
        <div class="trace-row">
          <span>${escapeHtml(draft.trace?.label || 'No draft trace')}</span>
          <span>${escapeHtml(challenge.trace?.label || 'No challenge trace')}</span>
        </div>
      </article>
    </section>
  `;
}

function fillPrompt(text = '') {
  const input = document.getElementById('risk-statement');
  input.value = text;
  input.focus();
}

function renderLoadingState() {
  const steps = [
    'Reading runtime mode',
    'Framing the event path',
    'Pressure-testing the lens',
    'Preparing approval questions'
  ];
  const activeLabel = steps[loadingStep % steps.length];
  return `
    <section class="loading-feed">
      <div class="loading-feed__orbit"></div>
      <div class="loading-feed__copy">
        <p class="micro-label">Agent in progress</p>
        <h2>${escapeHtml(activeLabel)}</h2>
        <p>The run updates after each bounded pass so you can see the framing pass, the challenge pass, and the final approval queue forming in sequence.</p>
      </div>
      <div class="loading-steps">
        ${steps.map((label, index) => `
          <article class="loading-step ${index === (loadingStep % steps.length) ? 'loading-step--active' : ''}">
            <span>${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
            <strong>${escapeHtml(label)}</strong>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function startLoadingSequence(resultsPanel) {
  loadingStep = 0;
  resultsPanel.innerHTML = renderLoadingState();
  loadingTimer = window.setInterval(() => {
    loadingStep += 1;
    resultsPanel.innerHTML = renderLoadingState();
  }, 900);
}

function stopLoadingSequence() {
  if (loadingTimer) {
    window.clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

async function runAgent(event) {
  event.preventDefault();
  const runButton = document.getElementById('run-agent');
  const resultsPanel = document.getElementById('results-panel');

  runButton.disabled = true;
  runButton.textContent = 'Running…';
  startLoadingSequence(resultsPanel);

  const payload = {
    riskStatement: document.getElementById('risk-statement').value,
    businessUnit: '',
    geography: ''
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
    stopLoadingSequence();
    resultsPanel.innerHTML = renderResult(result);
  } catch (error) {
    stopLoadingSequence();
    resultsPanel.innerHTML = `
      <section class="error-feed">
        <p class="micro-label">Run failed</p>
        <h2>The agent could not complete this mission</h2>
        <p>${escapeHtml(error.message || 'Unknown error')}</p>
      </section>
    `;
  } finally {
    runButton.disabled = false;
    runButton.textContent = 'Launch Agent Run';
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
  document.getElementById('provider-chip').textContent = 'Boundary error';
  document.getElementById('runtime-detail').textContent = message;
  document.getElementById('runtime-mode').textContent = 'Runtime error';
});
