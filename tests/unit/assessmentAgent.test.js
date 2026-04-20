'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runAssessmentAgent } = require('../../lib/assessmentAgent');

test('assessment agent blocks empty input before any tool work', async () => {
  const result = await runAssessmentAgent({});

  assert.equal(result.ok, false);
  assert.equal(result.activity.length, 1);
  assert.equal(result.activity[0].status, 'blocked');
});

test('assessment agent runs a bounded draft and challenge pass', async () => {
  const mockClient = {
    mode: 'mock',
    async getRuntimeStatus() {
      return { ok: true, mode: 'mock', message: 'Mock runtime ready.' };
    },
    async draftScenario() {
      return {
        scenarioLens: { key: 'business-continuity', label: 'Business Continuity' },
        draftNarrative: 'Corporate Services could face a prolonged communications outage due to missing failover coverage.',
        risks: [{ title: 'Communications outage', category: 'Business Continuity', description: 'Email service recovery gap.' }],
        missingInformation: ['Which geography matters most?']
      };
    },
    async challengeAssessment() {
      return {
        critiqueSummary: 'The event path is usable, but impact quantification is still weak.',
        challengeQuestions: ['What is the likely duration of disruption?']
      };
    }
  };

  const result = await runAssessmentAgent({
    riskStatement: 'There is no disaster recovery for the critical email system.',
    businessUnit: 'Corporate Services'
  }, {
    client: mockClient
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'mock');
  assert.equal(result.activity.length, 4);
  assert.equal(result.summary.scenarioLens.label, 'Business Continuity');
  assert.match(result.summary.draftNarrative, /communications outage/i);
  assert.deepEqual(result.summary.clarifyingQuestions, [
    'Which geography or legal perimeter matters most?',
    'Which geography matters most?',
    'What is the likely duration of disruption?'
  ]);
});
