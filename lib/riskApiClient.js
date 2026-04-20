'use strict';

const { getConfig } = require('./config');

function normaliseText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function inferLensKey(text = '') {
  const source = normaliseText(text).toLowerCase();
  if (!source) return 'general-enterprise-risk';
  if (/outage|dr\b|disaster recovery|failover|continuity|recovery|availability/.test(source)) return 'business-continuity';
  if (/identity|credential|azure|phish|ransom|cyber|access|breach|compromise/.test(source)) return 'cyber';
  if (/supplier|vendor|third[- ]party|delivery|procurement/.test(source)) return 'third-party';
  if (/fraud|invoice|payment|control/.test(source)) return 'financial-controls';
  if (/privacy|retention|transfer|personal data|disclosure/.test(source)) return 'data-governance-privacy';
  if (/esg|human rights|forced labour|greenwashing/.test(source)) return 'esg';
  return 'general-enterprise-risk';
}

function toLensLabel(key = '') {
  return String(key || '')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildMockDraft(input = {}) {
  const riskStatement = normaliseText(input.riskStatement || '');
  const lensKey = inferLensKey(riskStatement);
  const businessUnit = normaliseText(input.businessUnit || 'Core Operations');
  const geography = normaliseText(input.geography || 'Global');
  const questions = [];

  if (riskStatement.split(' ').length < 8) {
    questions.push('What specific event are you most worried about?');
  }
  if (!input.businessUnit) {
    questions.push('Which business unit owns the exposure?');
  }
  if (!input.geography) {
    questions.push('What geography or regulatory perimeter matters most?');
  }

  const narrative = riskStatement
    ? `${businessUnit} could face a material ${toLensLabel(lensKey).toLowerCase()} scenario in ${geography} if ${riskStatement.charAt(0).toLowerCase()}${riskStatement.slice(1)} This would likely create operational disruption, management pressure, and a need for explicit response ownership.`
    : '';

  return {
    mode: 'mock',
    usedFallback: false,
    aiUnavailable: false,
    scenarioLens: {
      key: lensKey,
      label: toLensLabel(lensKey)
    },
    draftNarrativeSource: 'mock',
    draftNarrative: narrative,
    risks: [
      {
        title: `${toLensLabel(lensKey)} scenario`,
        category: toLensLabel(lensKey),
        description: `Primary agent-authored risk framing for ${businessUnit}.`
      },
      {
        title: 'Escalation and control pressure',
        category: 'Management Response',
        description: 'Secondary pressure on governance, communications, and mitigation bandwidth.'
      }
    ],
    missingInformation: questions,
    shortlistCoherence: {
      mode: 'accepted',
      confidenceBand: questions.length ? 'medium' : 'high'
    },
    trace: {
      label: 'Mock scenario draft',
      response: 'Deterministic local draft generated without live AI.'
    }
  };
}

function buildMockChallenge(input = {}) {
  const narrative = normaliseText(input.narrative || '');
  const risks = Array.isArray(input.risks) ? input.risks : [];
  const questions = [];

  if (!/cause|because|trigger|due to/i.test(narrative)) {
    questions.push('What is the most credible trigger or failure path?');
  }
  if (!/impact|disruption|loss|delay|regulatory|service/i.test(narrative)) {
    questions.push('What is the primary business impact if this scenario occurs?');
  }
  if (!risks.length) {
    questions.push('Which risk themes should stay on the shortlist?');
  }

  return {
    mode: 'mock',
    critiqueSummary: questions.length
      ? 'The scenario is directionally usable, but the event path and business impact still need sharper definition.'
      : 'The scenario is coherent enough for a first estimation pass.',
    challengeQuestions: questions,
    trace: {
      label: 'Mock challenge pass',
      response: 'Deterministic challenge pass completed locally.'
    }
  };
}

function createMockRiskApiClient() {
  return {
    mode: 'mock',
    async getRuntimeStatus() {
      return {
        ok: true,
        mode: 'mock',
        message: 'Running in deterministic local mock mode.'
      };
    },
    async draftScenario(input) {
      return buildMockDraft(input);
    },
    async challengeAssessment(input) {
      return buildMockChallenge(input);
    }
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Remote API returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

function createRemoteRiskApiClient(config = getConfig()) {
  const baseUrl = String(config.remoteApiBaseUrl || '').replace(/\/+$/g, '');
  if (!baseUrl) {
    throw new Error('REMOTE_API_BASE_URL is required when AGENT_API_MODE=remote.');
  }

  async function request(path, { method = 'GET', body } = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (config.remoteApiToken) headers.authorization = `Bearer ${config.remoteApiToken}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.remoteApiTimeoutMs)
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload.error || `Remote request failed with status ${response.status}`);
    }
    return payload;
  }

  return {
    mode: 'remote',
    async getRuntimeStatus() {
      return request('/api/health');
    },
    async draftScenario(input) {
      return request('/api/agent/draft', {
        method: 'POST',
        body: input
      });
    },
    async challengeAssessment(input) {
      return request('/api/agent/challenge', {
        method: 'POST',
        body: input
      });
    }
  };
}

function createRiskApiClient(config = getConfig()) {
  return config.agentApiMode === 'remote'
    ? createRemoteRiskApiClient(config)
    : createMockRiskApiClient();
}

module.exports = {
  createRiskApiClient,
  createMockRiskApiClient,
  createRemoteRiskApiClient
};
