# Agentic Risk Intelligence

Standalone prototype repo for an agentic risk workflow.

The design constraint is deliberate:

- local development can run on your machine
- local code does **not** call Compass directly
- live AI calls must go through a hosted API boundary such as Vercel

This repo therefore supports two runtime modes:

- `mock`: fully local development and tests with deterministic sample outputs
- `remote`: local UI and agent runtime call a hosted gateway API

## Why a separate repo

This keeps agentic experimentation isolated from `risk-calculator` while you prove:

- the right agent loop
- the right tool surface
- the right hosted API boundary
- the right user checkpoints

If the prototype works, you can later fold the successful pieces back into the main product.

## Current shape

- `server.js`: local dev server
- `public/`: small browser UI
- `lib/assessmentAgent.js`: bounded assessment agent orchestration
- `lib/riskApiClient.js`: mock client and hosted-gateway client

## Local run

```bash
npm run dev
```

Open `http://127.0.0.1:3010`.

## Local test

```bash
npm test
npm run check:syntax
```

## Remote mode

Set these environment variables when you are ready to use a hosted gateway:

```bash
AGENT_API_MODE=remote
REMOTE_API_BASE_URL=https://your-gateway.vercel.app
REMOTE_API_TOKEN=optional-shared-token
REMOTE_API_TIMEOUT_MS=30000
```

Expected remote gateway endpoints:

- `GET /api/health`
- `POST /api/agent/draft`
- `POST /api/agent/challenge`

That gateway is where Compass-facing logic should live. The browser and local Node process should only ever talk to the gateway.

## Recommended next step

Build the hosted gateway on Vercel first, then swap this repo from `mock` to `remote`. The UI and agent loop already separate orchestration from model access, which is the important boundary.
