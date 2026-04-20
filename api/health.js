'use strict';

const { getConfig } = require('../lib/config');
const { writeJson } = require('../lib/http');

module.exports = async function handler(_req, res) {
  const config = getConfig();
  writeJson(res, 200, {
    ok: true,
    mode: config.agentApiMode,
    remoteApiConfigured: Boolean(config.remoteApiBaseUrl),
    message: config.agentApiMode === 'mock'
      ? 'Local deterministic mock mode.'
      : 'Remote gateway mode.'
  });
};
