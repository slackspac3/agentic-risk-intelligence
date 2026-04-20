'use strict';

const { createRiskApiClient } = require('./riskApiClient');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildStep(status, title, detail, extra = {}) {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status,
    title,
    detail,
    ...extra
  };
}

function buildClarifyingQuestions(input = {}, draft = {}, challenge = {}) {
  const questions = new Set();

  if (!cleanText(input.businessUnit)) questions.add('Which business unit owns this risk?');
  if (!cleanText(input.geography)) questions.add('Which geography or legal perimeter matters most?');

  (Array.isArray(draft.missingInformation) ? draft.missingInformation : []).forEach((item) => {
    const value = cleanText(item);
    if (value) questions.add(value);
  });
  (Array.isArray(challenge.challengeQuestions) ? challenge.challengeQuestions : []).forEach((item) => {
    const value = cleanText(item);
    if (value) questions.add(value);
  });

  return Array.from(questions).slice(0, 5);
}

async function runAssessmentAgent(input = {}, options = {}) {
  const client = options.client || createRiskApiClient();
  const brief = cleanText(input.riskStatement || input.brief || '');

  if (!brief) {
    return {
      ok: false,
      mode: client.mode,
      message: 'Risk statement is required.',
      activity: [
        buildStep('blocked', 'Waiting For Input', 'Provide one plain-language statement describing what happened or could happen.')
      ]
    };
  }

  const activity = [
    buildStep('completed', 'Plan Built', 'The agent prepared a bounded draft-and-challenge pass.')
  ];

  const runtimeStatus = await client.getRuntimeStatus();
  activity.push(
    buildStep(
      runtimeStatus.mode === 'mock' ? 'completed' : 'in_progress',
      'Runtime Checked',
      runtimeStatus.message || 'Runtime status retrieved.',
      { runtimeStatus }
    )
  );

  const draft = await client.draftScenario({
    riskStatement: brief,
    geography: cleanText(input.geography || ''),
    businessUnit: cleanText(input.businessUnit || '')
  });
  activity.push(
    buildStep(
      'completed',
      'Scenario Drafted',
      draft.draftNarrative || 'Scenario draft completed.',
      {
        mode: draft.mode || client.mode,
        scenarioLens: draft.scenarioLens || null
      }
    )
  );

  const challenge = await client.challengeAssessment({
    narrative: draft.draftNarrative || '',
    risks: Array.isArray(draft.risks) ? draft.risks : []
  });
  activity.push(
    buildStep(
      'completed',
      'Challenge Pass Completed',
      cleanText(challenge.critiqueSummary || 'Challenge pass completed.')
    )
  );

  const clarifyingQuestions = buildClarifyingQuestions(input, draft, challenge);

  return {
    ok: true,
    mode: client.mode,
    runtimeStatus,
    summary: {
      scenarioLens: draft.scenarioLens || null,
      draftNarrative: cleanText(draft.draftNarrative || ''),
      critiqueSummary: cleanText(challenge.critiqueSummary || ''),
      clarifyingQuestions
    },
    outputs: {
      draft,
      challenge
    },
    activity
  };
}

module.exports = {
  runAssessmentAgent
};
