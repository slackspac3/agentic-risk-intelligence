'use strict';

const { runAssessmentAgent } = require('../../lib/assessmentAgent');
const { readJsonBody, writeJson } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    writeJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await runAssessmentAgent(body);
    writeJson(res, result.ok ? 200 : 400, result);
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
};
