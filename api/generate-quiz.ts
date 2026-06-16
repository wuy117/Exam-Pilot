import { examSystemPrompt, handleApiError, quizSchema, summarizeContext } from './_exam.js';
import { callOpenAIJson, methodNotAllowed, readJsonBody, requireString, sendJson } from './_openai.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, req);
  if (req.method !== 'POST') return methodNotAllowed(res, req);

  try {
    const body = await readJsonBody(req);
    const topic = requireString(body.topic, 'topic', 500);
    const difficulty = String(body.difficulty || 'Normal');

    const result = await callOpenAIJson({
      schemaName: 'exam_quiz',
      schema: quizSchema,
      messages: [
        { role: 'system', content: examSystemPrompt() },
        {
          role: 'user',
          content: [
            'Generate a GCSE/IGCSE practice set with multiple-choice, short-answer, definition, and exam-style questions.',
            'For essay subjects, include an essay-plan question when appropriate.',
            'Every question must include answer guidance, a short explanation, and mark-scheme style points.',
            `Topic: ${topic}`,
            `Difficulty: ${difficulty}`,
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
