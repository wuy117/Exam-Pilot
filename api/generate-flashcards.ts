import { examSystemPrompt, flashcardsSchema, handleApiError, summarizeContext } from './_exam.js';
import { callOpenAIJson, methodNotAllowed, readJsonBody, requireString, sendJson } from './_openai.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, req);
  if (req.method !== 'POST') return methodNotAllowed(res, req);

  try {
    const body = await readJsonBody(req);
    const guidance = requireString(body.guidance || body.guidanceText || body.content, 'guidance text');

    const result = await callOpenAIJson({
      schemaName: 'exam_flashcards',
      schema: flashcardsSchema,
      messages: [
        { role: 'system', content: examSystemPrompt() },
        {
          role: 'user',
          content: [
            'Generate concise GCSE/IGCSE flashcards from the supplied guidance.',
            'Prefer retrieval questions that map to mark-scheme language, command words, definitions, processes, and common mistakes.',
            'Return 6 to 12 cards. Use difficulty Good by default, Hard for likely weak or high-value topics.',
            `Context JSON:\n${summarizeContext(body)}`,
            `Guidance text:\n${guidance}`,
          ].join('\n\n'),
        },
      ],
    });

    return sendJson(res, 200, result, req);
  } catch (error) {
    return handleApiError(error, res, req);
  }
}
