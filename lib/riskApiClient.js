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

function sanitizeAiText(value = '', { maxChars = 20000 } = {}) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function coerceTextContent(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && item.text && typeof item.text.value === 'string') return item.text.value;
        if (item && item.text && typeof item.text.content === 'string') return item.text.content;
        if (item && item.type === 'output_text' && typeof item.value === 'string') return item.value;
        if (item && typeof item.content === 'string') return item.content;
        if (item && Array.isArray(item.content)) return coerceTextContent(item.content);
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    return joined || null;
  }
  if (value && typeof value.text === 'string') return value.text;
  if (value && value.text && typeof value.text.value === 'string') return value.text.value;
  if (value && typeof value.content === 'string') return value.content;
  if (value && Array.isArray(value.content)) return coerceTextContent(value.content);
  if (value && typeof value.value === 'string') return value.value;
  return null;
}

function describeLlmResponse(data = {}) {
  const choices = Array.isArray(data?.choices) ? data.choices : [];
  for (const choice of choices) {
    const directMessage = coerceTextContent(choice?.message?.content);
    if (directMessage) {
      return {
        text: directMessage,
        diagnostic: 'assistant message content found'
      };
    }

    const directOutput = coerceTextContent(choice?.content);
    if (directOutput) {
      return {
        text: directOutput,
        diagnostic: 'choice content found'
      };
    }

    const textField = coerceTextContent(choice?.text);
    if (textField) {
      return {
        text: textField,
        diagnostic: 'choice text found'
      };
    }

    const finishReason = sanitizeAiText(choice?.finish_reason || '', { maxChars: 120 });
    const messageKeys = choice?.message && typeof choice.message === 'object'
      ? Object.keys(choice.message).slice(0, 8).join(', ')
      : '';
    const choiceKeys = choice && typeof choice === 'object'
      ? Object.keys(choice).slice(0, 8).join(', ')
      : '';
    return {
      text: null,
      diagnostic: `choices[0] had no usable text${finishReason ? `; finish_reason: ${finishReason}` : ''}${messageKeys ? `; message keys: ${messageKeys}` : ''}${choiceKeys ? `; choice keys: ${choiceKeys}` : ''}`.trim()
    };
  }

  const outputText = coerceTextContent(data?.output_text);
  if (outputText) {
    return {
      text: outputText,
      diagnostic: 'output_text found'
    };
  }

  const responsesOutput = Array.isArray(data?.output) ? data.output : [];
  for (const item of responsesOutput) {
    const joined = coerceTextContent(item?.content);
    if (joined) {
      return {
        text: joined,
        diagnostic: 'responses output content found'
      };
    }
  }

  const topKeys = Object.keys(data || {}).slice(0, 8).join(', ');
  return {
    text: null,
    diagnostic: `no supported content fields found; top-level keys: ${topKeys || '(none)'}`
  };
}

function extractLlmTextResponse(payload = {}) {
  return describeLlmResponse(payload).text;
}

function extractBalancedJsonCandidate(text = '') {
  const source = String(text || '');
  const start = source.search(/[\[{]/);
  if (start < 0) return '';
  const stack = [];
  let inString = false;
  let escapeNext = false;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      if (stack[stack.length - 1] !== expected) break;
      stack.pop();
      if (!stack.length) {
        return source.slice(start, index + 1);
      }
    }
  }
  return '';
}

function extractJsonCandidate(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const balanced = extractBalancedJsonCandidate(text);
  if (balanced) return balanced.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim();
  return text;
}

function parseJsonResponse(raw = '') {
  const candidate = extractJsonCandidate(raw);
  if (!candidate) {
    throw new Error('AI returned an empty response.');
  }
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('AI returned invalid JSON.');
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Remote API returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function buildLensLabel(key = '') {
  return toLensLabel(key) || 'General Enterprise Risk';
}

function normaliseRiskList(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 5)
    .map((item) => ({
      title: normaliseText(item.title || item.name || 'Untitled risk'),
      category: normaliseText(item.category || item.lens || 'Risk'),
      description: normaliseText(item.description || item.summary || '')
    }));
}

async function callCompassJson(systemPrompt, userPrompt, { maxCompletionTokens = 1200, temperature = 0.2, timeoutMs } = {}, config = getConfig()) {
  if (!config.compassApiKey) {
    throw new Error('COMPASS_API_KEY is not configured.');
  }

  const response = await fetchWithTimeout(config.compassApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.compassApiKey}`
    },
    body: JSON.stringify({
      model: config.compassModel,
      max_completion_tokens: maxCompletionTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  }, Number(timeoutMs || config.remoteApiTimeoutMs || 30000));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Compass request failed with status ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const described = describeLlmResponse(payload);
  const text = described.text;
  if (!text) {
    throw new Error(`AI returned no usable text. ${described.diagnostic}`);
  }
  return {
    text,
    parsed: parseJsonResponse(text)
  };
}

function buildDraftFallback(input = {}, reason = '') {
  const fallback = buildMockDraft(input);
  return {
    ...fallback,
    mode: 'deterministic_fallback',
    usedFallback: true,
    aiUnavailable: false,
    draftNarrativeSource: 'fallback',
    trace: {
      label: 'Fallback scenario draft',
      response: sanitizeAiText(reason || 'Live AI draft failed and the deterministic fallback was used.', { maxChars: 2000 })
    }
  };
}

function buildChallengeFallback(input = {}, reason = '') {
  const fallback = buildMockChallenge(input);
  return {
    ...fallback,
    mode: 'deterministic_fallback',
    trace: {
      label: 'Fallback challenge pass',
      response: sanitizeAiText(reason || 'Live AI challenge failed and the deterministic fallback was used.', { maxChars: 2000 })
    }
  };
}

async function buildLiveDraft(input = {}, config = getConfig()) {
  const riskStatement = normaliseText(input.riskStatement || '');
  const businessUnit = normaliseText(input.businessUnit || 'Core Operations');
  const geography = normaliseText(input.geography || 'Global');
  const fallbackLensKey = inferLensKey(riskStatement);
  const schema = {
    scenarioLens: {
      key: 'business-continuity',
      label: 'Business Continuity'
    },
    draftNarrative: 'string',
    risks: [
      { title: 'string', category: 'string', description: 'string' }
    ],
    missingInformation: ['string']
  };
  const systemPrompt = [
    'You are an enterprise risk analyst.',
    'Return JSON only.',
    'Keep the event path precise and avoid generic cyber, compliance, or cloud wording unless the user input supports it.',
    'The narrative should be concise, decision-oriented, and suitable for a management review workflow.'
  ].join(' ');
  const userPrompt = [
    `Business unit: ${businessUnit}`,
    `Geography: ${geography}`,
    `Risk statement: ${riskStatement}`,
    'Return JSON matching this schema exactly:',
    JSON.stringify(schema, null, 2)
  ].join('\n\n');
  try {
    const result = await callCompassJson(systemPrompt, userPrompt, {
      maxCompletionTokens: 1400,
      temperature: 0.2
    }, config);
    const parsed = result.parsed || {};
    const lensKey = normaliseText(parsed?.scenarioLens?.key || fallbackLensKey).toLowerCase() || fallbackLensKey;

    return {
      mode: 'live',
      usedFallback: false,
      aiUnavailable: false,
      scenarioLens: {
        key: lensKey,
        label: normaliseText(parsed?.scenarioLens?.label || buildLensLabel(lensKey))
      },
      draftNarrativeSource: 'live',
      draftNarrative: normaliseText(parsed?.draftNarrative || ''),
      risks: normaliseRiskList(parsed?.risks),
      missingInformation: (Array.isArray(parsed?.missingInformation) ? parsed.missingInformation : [])
        .map((item) => normaliseText(item))
        .filter(Boolean)
        .slice(0, 5),
      shortlistCoherence: {
        mode: 'live',
        confidenceBand: 'medium'
      },
      trace: {
        label: 'Live scenario draft',
        response: result.text
      }
    };
  } catch (error) {
    return buildDraftFallback(input, error?.message || error);
  }
}

async function buildLiveChallenge(input = {}, config = getConfig()) {
  const narrative = normaliseText(input.narrative || '');
  const risks = normaliseRiskList(input.risks);
  const schema = {
    critiqueSummary: 'string',
    challengeQuestions: ['string']
  };
  const systemPrompt = [
    'You are a skeptical enterprise risk reviewer.',
    'Return JSON only.',
    'Identify what is weak, missing, overstated, or insufficiently evidenced.'
  ].join(' ');
  const userPrompt = [
    `Narrative: ${narrative}`,
    `Shortlisted risks: ${JSON.stringify(risks, null, 2)}`,
    'Return JSON matching this schema exactly:',
    JSON.stringify(schema, null, 2)
  ].join('\n\n');
  try {
    const result = await callCompassJson(systemPrompt, userPrompt, {
      maxCompletionTokens: 900,
      temperature: 0.1
    }, config);
    const parsed = result.parsed || {};

    return {
      mode: 'live',
      critiqueSummary: normaliseText(parsed?.critiqueSummary || ''),
      challengeQuestions: (Array.isArray(parsed?.challengeQuestions) ? parsed.challengeQuestions : [])
        .map((item) => normaliseText(item))
        .filter(Boolean)
        .slice(0, 5),
      trace: {
        label: 'Live challenge pass',
        response: result.text
      }
    };
  } catch (error) {
    return buildChallengeFallback(input, error?.message || error);
  }
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

function createRemoteRiskApiClient(config = getConfig()) {
  return {
    mode: 'live',
    async getRuntimeStatus() {
      return {
        ok: Boolean(config.compassApiKey),
        mode: config.compassApiKey ? 'live' : 'degraded',
        message: config.compassApiKey
          ? 'Vercel serverless routes are configured for live Compass calls.'
          : 'AGENT_API_MODE is remote, but COMPASS_API_KEY is missing.'
      };
    },
    async draftScenario(input) {
      return buildLiveDraft(input, config);
    },
    async challengeAssessment(input) {
      return buildLiveChallenge(input, config);
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
