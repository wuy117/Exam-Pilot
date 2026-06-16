import { examSystemPrompt, expertSchema, handleApiError, summarizeContext } from './_exam.js';
import { callOpenAIJson, methodNotAllowed, readJsonBody, requireString, sendJson } from './_openai.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, req);
  if (req.method !== 'POST') return methodNotAllowed(res, req);

  try {
    const body = await readJsonBody(req);
    const question = requireString(body.question, 'question', 4000);

    const result = await callOpenAIJson<{ answer: string; contextUsed: string; suggestedNextSteps: string[] }>({
      schemaName: 'exam_expert_answer',
      schema: expertSchema,
      messages: [
        { role: 'system', content: examSystemPrompt() },
        {
          role: 'user',
          content: [
            'Answer the student question using stored revision guidance first.',
            'If the question asks for an essay plan, return a structured plan with argument, evidence prompts, and timing.',
            'If it asks to test the student, create short self-test questions and answer criteria.',
            'If it asks for explanation, keep it clear and GCSE/IGCSE appropriate.',
            `Question:\n${question}`,
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
