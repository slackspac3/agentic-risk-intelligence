'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRemoteRiskApiClient } = require('../../lib/riskApiClient');

test('remote risk API client builds live draft output from Compass JSON response', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                scenarioLens: {
                  key: 'business-continuity',
                  label: 'Business Continuity'
                },
                draftNarrative: 'Corporate Services could face a prolonged communications outage due to missing failover coverage.',
                risks: [
                  {
                    title: 'Communications outage',
                    category: 'Business Continuity',
                    description: 'Critical services could be disrupted for longer than expected.'
                  }
                ],
                missingInformation: [
                  'What recovery-time expectation matters most?'
                ]
              })
            }
          }
        ]
      };
    }
  });

  try {
    const client = createRemoteRiskApiClient({
      agentApiMode: 'remote',
      compassApiUrl: 'https://example.test/compass',
      compassApiKey: 'secret',
      compassModel: 'gpt-5.1',
      remoteApiTimeoutMs: 1000
    });

    const result = await client.draftScenario({
      riskStatement: 'There is no disaster recovery for the critical email system.',
      businessUnit: 'Corporate Services',
      geography: 'UAE'
    });

    assert.equal(result.mode, 'live');
    assert.equal(result.scenarioLens.key, 'business-continuity');
    assert.match(result.draftNarrative, /communications outage/i);
    assert.equal(result.risks[0].title, 'Communications outage');
    assert.equal(result.missingInformation[0], 'What recovery-time expectation matters most?');
    assert.equal(result.trace.label, 'Live scenario draft');
  } finally {
    global.fetch = originalFetch;
  }
});
