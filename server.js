'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');

const { getConfig } = require('./lib/config');
const { runAssessmentAgent } = require('./lib/assessmentAgent');

const config = getConfig();
const publicRoot = path.join(__dirname, 'public');

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function serveStaticFile(req, res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(publicRoot, relativePath));
  if (!filePath.startsWith(publicRoot)) {
    writeJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      writeJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      writeJson(res, 200, {
        ok: true,
        mode: config.agentApiMode,
        remoteApiConfigured: Boolean(config.remoteApiBaseUrl),
        message: config.agentApiMode === 'mock'
          ? 'Local deterministic mock mode.'
          : 'Remote gateway mode.'
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      writeJson(res, 200, {
        ok: true,
        config: {
          mode: config.agentApiMode,
          remoteApiConfigured: Boolean(config.remoteApiBaseUrl)
        }
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/run') {
      const body = await readRequestBody(req);
      const result = await runAssessmentAgent(body);
      writeJson(res, result.ok ? 200 : 400, result);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStaticFile(req, res, url.pathname);
      return;
    }

    writeJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
});

server.listen(config.port, '127.0.0.1', () => {
  process.stdout.write(`Agentic Risk Intelligence listening on http://127.0.0.1:${config.port}\n`);
});
