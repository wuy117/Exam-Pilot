declare const Buffer: any;
declare const process: any;

type JsonSchema = Record<string, unknown>;

export class PublicApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(res: any, status: number, body: unknown, req?: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', corsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  res.end(status === 204 ? '' : JSON.stringify(body));
}

export function methodNotAllowed(res: any, req?: any) {
  sendJson(res, 405, { error: 'Method not allowed.' }, req);
}

export function requireString(value: unknown, field: string, maxLength = 20000) {
  const text = String(value || '').trim();
  if (!text) throw new PublicApiError(`${field} is required.`, 400);
  if (text.length > maxLength) throw new PublicApiError(`${field} is too long.`, 400);
  return text;
}

export function optionalString(value: unknown, maxLength = 2000) {
  const text = String(value || '').trim();
  return text.slice(0, maxLength);
}

export function requireArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new PublicApiError(`${field} must be an array.`, 400);
  return value;
}

export async function callOpenAIJson<T>({
  messages,
  schema,
  schemaName,
  temperature = 0.25,
}: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  schema: JsonSchema;
  schemaName: string;
  temperature?: number;
}): Promise<T> {
  const { baseUrl, model, apiKey } = getAiConfig();
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const requestBody = {
    model,
    messages: withJsonInstruction(messages, schema),
    temperature,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        schema,
        strict: true,
      },
    },
  };

  let response = await postProvider(endpoint, apiKey, requestBody);
  let payload = await response.json().catch(() => null);

  if (!response.ok && shouldRetryWithoutJsonSchema(response.status, payload)) {
    response = await postProvider(endpoint, apiKey, { ...requestBody, response_format: undefined });
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'AI service unavailable. Please try again later.';
    throw new PublicApiError(message, response.status);
  }

  const outputText = extractChatText(payload);
  if (!outputText) throw new PublicApiError('AI service returned an empty response.', 502);

  try {
    return JSON.parse(cleanJson(outputText)) as T;
  } catch {
    throw new PublicApiError('AI service returned invalid JSON.', 502);
  }
}

function getAiConfig() {
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  const apiKey = process.env.AI_API_KEY;

  if (!baseUrl) throw new PublicApiError('AI_BASE_URL is not configured.', 500);
  if (!model) throw new PublicApiError('AI_MODEL is not configured.', 500);
  if (!apiKey) throw new PublicApiError('AI_API_KEY is not configured.', 500);

  return { baseUrl, model, apiKey };
}

function withJsonInstruction(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, schema: JsonSchema) {
  const jsonInstruction = `Return only valid JSON matching this schema: ${JSON.stringify(schema)}`;
  const [first, ...rest] = messages;
  if (!first) return [{ role: 'system' as const, content: jsonInstruction }];
  return [{ ...first, content: `${first.content}\n\n${jsonInstruction}` }, ...rest];
}

async function postProvider(endpoint: string, apiKey: string, body: unknown) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function shouldRetryWithoutJsonSchema(status: number, payload: any) {
  const message = `${payload?.error?.message || payload?.message || ''}`.toLowerCase();
  return status === 400 && (message.includes('response_format') || message.includes('json_schema'));
}

function extractChatText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part?.text || part?.content || '').join('');
  return '';
}

function cleanJson(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
}

function corsOrigin(req?: any) {
  const configured = process.env.AI_ALLOWED_ORIGINS || '*';
  if (configured === '*') return '*';

  const allowed = configured.split(',').map((origin: string) => origin.trim()).filter(Boolean);
  const requestOrigin = req?.headers?.origin || req?.headers?.Origin;
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(requestOrigin)) return requestOrigin;
  return allowed[0] || '*';
}
