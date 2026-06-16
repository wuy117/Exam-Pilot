import type { ExamPilotData } from '../types';

const now = new Date().toISOString();
const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const emptyData: ExamPilotData = {
  subjects: [],
  guidance: [],
  topics: [],
  sessions: [],
  flashcards: [],
  practiceQuestions: [],
  weakTopics: [],
  aiMessages: [],
};

export const sampleData: ExamPilotData = {
  subjects: [
    {
      id: 'subject-chemistry',
      name: 'Chemistry',
      examDate: daysFromNow(18),
      priority: 'Critical',
      confidence: 3,
      colour: '#0f766e',
      notes: 'Paper 2 needs more exam-question practice, especially calculations.',
      createdAt: now,
    },
    {
      id: 'subject-history',
      name: 'History',
      examDate: daysFromNow(31),
      priority: 'High',
      confidence: 2,
      colour: '#7c3aed',
      notes: 'Essay structure and evidence recall are the main risks.',
      createdAt: now,
    },
  ],
  guidance: [
    {
      id: 'guidance-chemistry',
      subjectId: 'subject-chemistry',
      title: 'Teacher checklist: acids and electrolysis',
      content:
        'Revise strong and weak acids, pH calculations, neutralisation, salt preparation, electrolysis of molten ionic compounds, aqueous electrolysis, half equations, and required practical method questions.',
      createdAt: now,
      updatedAt: now,
    },
  ],
  topics: [],
  sessions: [
    {
      id: 'session-chemistry-acids',
      subjectId: 'subject-chemistry',
      title: 'Chemistry acids: exam questions',
      type: 'revision',
      date: daysFromNow(1),
      startTime: '19:30',
      durationMinutes: 45,
      mode: 'Normal',
      status: 'planned',
      topic: 'Acids',
      reason: 'Close exam date, high priority, medium confidence.',
    },
  ],
  flashcards: [
    {
      id: 'card-neutralisation',
      subjectId: 'subject-chemistry',
      topic: 'Acids',
      question: 'What is neutralisation?',
      answer: 'A reaction between an acid and a base that forms salt and water.',
      difficulty: 'Hard',
      nextReview: daysFromNow(0),
      createdAt: now,
    },
  ],
  practiceQuestions: [],
  weakTopics: [
    {
      id: 'weak-acids',
      subjectId: 'subject-chemistry',
      topic: 'Acids',
      score: 4,
      sources: ['sample practice'],
      updatedAt: now,
    },
  ],
  aiMessages: [],
};
