# Agentic Risk Intelligence

Standalone prototype repo for an agentic risk workflow.

The design constraint is deliberate:

- local development can run on your machine
- local code does **not** call Compass directly
- live AI calls must go through a hosted API boundary such as Vercel

This repo therefore supports two runtime modes:

- `mock`: fully local development and tests with deterministic sample outputs
- `remote`: the Vercel-hosted API routes call Compass server-side using environment variables

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

Set these environment variables when you are ready to use live AI inside Vercel:

```bash
AGENT_API_MODE=remote
COMPASS_API_KEY=your-secret
COMPASS_MODEL=gpt-5.1
```

Optional variables:

- `COMPASS_API_URL`
- `REMOTE_API_TIMEOUT_MS`

The browser still only talks to this app's own `/api/*` endpoints. Compass-facing logic stays inside Vercel serverless functions.

## Recommended next step

Deploy this repo to Vercel, add the Compass environment variables there, then switch from `mock` to `remote`. The UI and agent loop already separate orchestration from model access, which is the important boundary.
