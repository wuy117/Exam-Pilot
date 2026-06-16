import { analysisSchema, examSystemPrompt, handleApiError, summarizeContext } from './_exam.js';
import { callOpenAIJson, methodNotAllowed, readJsonBody, requireString, sendJson } from './_openai.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, req);
  if (req.method !== 'POST') return methodNotAllowed(res, req);

  try {
    const body = await readJsonBody(req);
    const content = requireString(body.content || body.guidanceText, 'guidance text');

    const result = await callOpenAIJson({
      schemaName: 'exam_guidance_analysis',
      schema: analysisSchema,
      messages: [
        { role: 'system', content: examSystemPrompt() },
        {
          role: 'user',
          content: [
            'Analyse this GCSE/IGCSE revision guidance/specification text.',
            'Extract key topics, subtopics, priority areas, exam question types, suggested tasks, and likely weak areas.',
            `Context JSON:\n${summarizeContext(body)}`,
            `Guidance text:\n${content}`,
          ].join('\n\n'),
        },
      ],
    });

    return sendJson(res, 200, result, req);
  } catch (error) {
    return handleApiError(error, res, req);
  }
}
