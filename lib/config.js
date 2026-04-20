'use strict';

function readEnvString(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getConfig() {
  const mode = readEnvString('AGENT_API_MODE', 'mock').toLowerCase();
  return {
    port: readEnvNumber('PORT', 3010),
    agentApiMode: mode === 'mock' ? 'mock' : 'remote',
    remoteApiBaseUrl: readEnvString('REMOTE_API_BASE_URL'),
    remoteApiToken: readEnvString('REMOTE_API_TOKEN'),
    remoteApiTimeoutMs: readEnvNumber('REMOTE_API_TIMEOUT_MS', 30000),
    compassApiUrl: readEnvString('COMPASS_API_URL', 'https://api.core42.ai/v1/chat/completions'),
    compassApiKey: readEnvString('COMPASS_API_KEY'),
    compassModel: readEnvString('COMPASS_MODEL', 'gpt-5.1')
  };
}

module.exports = {
  getConfig
};
