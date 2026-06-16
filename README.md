# ExamPilot

Premium local-first revision command centre for GCSE and IGCSE students.

## Run Locally

```bash
npm install
npm run dev
```

ExamPilot stores revision data in `localStorage` under `exampilot:data:v1`. The app starts empty; the sample-data button is clearly labelled and optional.

## AI Backend

ExamPilot uses Vercel serverless API routes in `api/`:

- `POST /api/exam-expert`
- `POST /api/analyse-guidance`
- `POST /api/generate-flashcards`
- `POST /api/generate-timetable`
- `POST /api/generate-quiz`

The frontend calls these routes through `src/services/ai.ts`. If the backend is unavailable or the server-side AI env vars are missing, the app falls back to the local mock AI logic so the revision workflow still works.

No AI provider key is ever placed in frontend code. Do not create `VITE_AI_API_KEY`, `VITE_OPENAI_API_KEY`, or similar client-exposed secrets.

## Environment Variables

Copy `.env.example` to `.env.local` for local Vercel-style development, or configure the same variables in Vercel Project Settings.

```bash
AI_API_KEY=your-provider-api-key
AI_BASE_URL=https://your-openai-compatible-provider.example.com/v1
AI_MODEL=your-model-name
AI_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-project.vercel.app
```

Optional for static deployments such as GitHub Pages:

```bash
VITE_AI_API_BASE_URL=https://your-vercel-backend.vercel.app
```

`VITE_AI_API_BASE_URL` is not a secret. It only tells the browser where the Vercel API is hosted when the frontend is served somewhere that cannot run `/api/*` routes.

## OpenAI-Compatible Providers

The backend sends requests to:

```text
${AI_BASE_URL}/chat/completions
```

using the model from `AI_MODEL` and bearer token from `AI_API_KEY`. The request uses OpenAI-compatible chat completions with JSON schema response formatting, then retries with prompt-enforced JSON if a provider rejects `json_schema`.

## Vercel Setup

1. Import the repository into Vercel.
2. Add `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and optionally `AI_ALLOWED_ORIGINS`.
3. Deploy.
4. Test one route, for example:

```bash
curl -X POST https://your-project.vercel.app/api/analyse-guidance \
  -H "Content-Type: application/json" \
  -d '{"content":"Revise acids, electrolysis, half equations, and required practical questions.","subjects":[],"guidance":[],"weakTopics":[],"flashcards":[],"sessions":[]}'
```

## Build

```bash
npm run build
```

The app uses Vite with `base: './'`, so the production build in `dist/` can be hosted on Vercel, Netlify, static hosting, or GitHub Pages. GitHub Pages cannot run the serverless routes, so set `VITE_AI_API_BASE_URL` to your deployed Vercel backend when using static hosting.
