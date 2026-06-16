import { PublicApiError, sendJson } from './_openai.js';

export const analysisSchema = {
  type: 'object',
  properties: {
    keyTopics: { type: 'array', items: { type: 'string' } },
    subtopics: { type: 'array', items: { type: 'string' } },
    priorityAreas: { type: 'array', items: { type: 'string' } },
    examQuestionTypes: { type: 'array', items: { type: 'string' } },
    suggestedRevisionTasks: { type: 'array', items: { type: 'string' } },
    likelyWeakAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['keyTopics', 'subtopics', 'priorityAreas', 'examQuestionTypes', 'suggestedRevisionTasks', 'likelyWeakAreas'],
  additionalProperties: false,
};

export const flashcardsSchema = {
  type: 'object',
  properties: {
    flashcards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          question: { type: 'string' },
          answer: { type: 'string' },
          difficulty: { type: 'string', enum: ['Again', 'Hard', 'Good', 'Easy'] },
        },
        required: ['topic', 'question', 'answer', 'difficulty'],
        additionalProperties: false,
      },
    },
  },
  required: ['flashcards'],
  additionalProperties: false,
};

export const timetableSchema = {
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subjectId: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['revision', 'lesson', 'chapel', 'meal', 'music', 'prep', 'sport', 'free-time', 'exam'] },
          date: { type: 'string' },
          startTime: { type: 'string' },
          durationMinutes: { type: 'number' },
          mode: { type: 'string', enum: ['Light', 'Normal', 'Panic'] },
          topic: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['subjectId', 'title', 'type', 'date', 'startTime', 'durationMinutes', 'mode', 'topic', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['sessions'],
  additionalProperties: false,
};

export const quizSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          type: { type: 'string', enum: ['multiple-choice', 'short-answer', 'definition', 'exam-style', 'essay-plan'] },
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerGuide: { type: 'string' },
          explanation: { type: 'string' },
          markSchemePoints: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'type', 'prompt', 'options', 'answerGuide', 'explanation', 'markSchemePoints'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export const expertSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    contextUsed: { type: 'string' },
    suggestedNextSteps: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'contextUsed', 'suggestedNextSteps'],
  additionalProperties: false,
};

export function examSystemPrompt() {
  return [
    'You are ExamPilot, a calm, precise GCSE/IGCSE revision coach for a serious boarding-school student.',
    'Use the learner supplied context first: uploaded knowledge documents, stored guidance, exam dates, priorities, topic mastery, weak topics, flashcards, sessions, past-paper items, previous mistakes, and subject notes.',
    'Treat uploaded specifications, mark schemes, revision guides, teacher notes, textbook extracts, and personal notes as the primary source of truth.',
    'Use general GCSE/IGCSE knowledge only when the supplied context is insufficient, and say when you are doing that.',
    'Keep advice exam-focused: command words, mark schemes, retrieval, timed practice, specification coverage, and honest weak-area diagnosis.',
    'Do not invent syllabus facts if the subject board/specification is unknown. Make uncertainty clear and suggest what guidance to paste.',
  ].join(' ');
}

export function summarizeContext(body: any) {
  return JSON.stringify(
    {
      selectedSubject: body.subject || body.selectedSubject || null,
      subjects: Array.isArray(body.subjects) ? body.subjects : [],
      guidance: Array.isArray(body.guidance) ? body.guidance : [],
      knowledgeDocuments: Array.isArray(body.knowledgeDocuments) ? body.knowledgeDocuments : [],
      topicMastery: Array.isArray(body.topicMastery) ? body.topicMastery : [],
      pastPaperItems: Array.isArray(body.pastPaperItems) ? body.pastPaperItems : [],
      weakTopics: Array.isArray(body.weakTopics) ? body.weakTopics : [],
      flashcards: Array.isArray(body.flashcards) ? body.flashcards : [],
      sessions: Array.isArray(body.sessions) ? body.sessions : [],
      examDates: Array.isArray(body.subjects)
        ? body.subjects.map((subject: any) => ({ id: subject.id, name: subject.name, examDate: subject.examDate }))
        : [],
    },
    null,
    2,
  );
}

export function handleApiError(error: unknown, res: any, req?: any) {
  const status = error instanceof PublicApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'AI service unavailable. Please try again later.';
  return sendJson(res, status, { error: message }, req);
}
