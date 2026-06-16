import { examSystemPrompt, handleApiError, summarizeContext, timetableSchema } from './_exam.js';
import { callOpenAIJson, methodNotAllowed, readJsonBody, requireArray, sendJson } from './_openai.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, req);
  if (req.method !== 'POST') return methodNotAllowed(res, req);

  try {
    const body = await readJsonBody(req);
    requireArray(body.subjects, 'subjects');
    const mode = body.mode === 'Light' || body.mode === 'Panic' ? body.mode : 'Normal';

    const result = await callOpenAIJson({
      schemaName: 'exam_timetable',
      schema: timetableSchema,
      messages: [
        { role: 'system', content: examSystemPrompt() },
        {
          role: 'user',
          content: [
            'Generate editable revision sessions around fixed commitments.',
            'Use exam dates, priority, confidence, weak topics, due flashcards, and available time.',
            'Avoid impossible schedules. In Panic mode, intensify focus but preserve sleep/meals. In Light mode, keep sessions short.',
            'Return only revision sessions, not the fixed commitments already supplied.',
            `Requested mode: ${mode}`,
            `Context JSON:\n${summarizeContext(body)}`,
          ].join('\n\n'),
        },
      ],
    });

    return sendJson(res, 200, result, req);
  } catch (error) {
    return handleApiError(error, res, req);
  }
}
