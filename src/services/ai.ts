import type {
  AIAnalysis,
  ExamPilotData,
  Flashcard,
  FlashcardDifficulty,
  PracticeQuestion,
  PracticeQuestionType,
  Subject,
  TimetableMode,
  TimetableSession,
} from '../types';

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const today = () => new Date().toISOString().slice(0, 10);

const apiBaseUrl = () => {
  const configured = import.meta.env.VITE_AI_API_BASE_URL;
  return configured ? configured.replace(/\/$/, '') : '';
};

const extractTopicCandidates = (text: string) => {
  const words = text
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 5);
  const seen = new Set<string>();
  return words
    .map((word) => word.replace(/-/g, ' '))
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 7);
};

const contextPayload = (data: ExamPilotData, subject?: Subject) => ({
  selectedSubject: subject,
  subject,
  subjects: data.subjects,
  guidance: data.guidance,
  weakTopics: data.weakTopics,
  flashcards: data.flashcards,
  sessions: data.sessions,
  timetableSessions: data.sessions,
  examDates: data.subjects.map((item) => ({ subjectId: item.id, name: item.name, examDate: item.examDate })),
});

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || `AI backend returned ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export const analyseGuidance = async (subject: Subject, content: string, data?: ExamPilotData): Promise<AIAnalysis> => {
  try {
    if (data) {
      return await postJson<AIAnalysis>('/api/analyse-guidance', {
        ...contextPayload(data, subject),
        content,
      });
    }
  } catch (error) {
    console.warn('Falling back to mock guidance analysis:', error);
  }
  return mockAnalyseGuidance(subject, content);
};

export const generateTimetable = async (data: ExamPilotData, mode: TimetableMode): Promise<TimetableSession[]> => {
  try {
    const result = await postJson<{ sessions: Array<Omit<TimetableSession, 'id' | 'status'> & Partial<TimetableSession>> }>('/api/generate-timetable', {
      ...contextPayload(data),
      commitments: data.sessions.filter((session) => session.type !== 'revision'),
      availableTime: inferAvailableTime(mode),
      mode,
    });
    return sanitizeSessions(result.sessions, mode);
  } catch (error) {
    console.warn('Falling back to mock timetable generation:', error);
    return mockGenerateTimetable(data, mode);
  }
};

export const generateFlashcards = async (subject: Subject, guidance: string, data?: ExamPilotData): Promise<Flashcard[]> => {
  try {
    if (data) {
      const result = await postJson<{ flashcards: Array<Pick<Flashcard, 'topic' | 'question' | 'answer' | 'difficulty'>> }>('/api/generate-flashcards', {
        ...contextPayload(data, subject),
        guidance,
      });
      return result.flashcards.map((card) => ({
        id: id('card'),
        subjectId: subject.id,
        topic: card.topic || 'General',
        question: card.question,
        answer: card.answer,
        difficulty: normalizeDifficulty(card.difficulty),
        nextReview: today(),
        createdAt: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.warn('Falling back to mock flashcard generation:', error);
  }
  return mockGenerateFlashcards(subject, guidance);
};

export const askExamExpert = async (question: string, subject: Subject | undefined, data: ExamPilotData): Promise<string> => {
  try {
    const result = await postJson<{ answer: string; contextUsed: string; suggestedNextSteps: string[] }>('/api/exam-expert', {
      ...contextPayload(data, subject),
      question,
    });
    const nextSteps = result.suggestedNextSteps?.length ? `\n\nNext steps:\n${result.suggestedNextSteps.map((step) => `- ${step}`).join('\n')}` : '';
    return [`Using context: ${result.contextUsed}`, result.answer, nextSteps].filter(Boolean).join('\n\n');
  } catch (error) {
    console.warn('Falling back to mock Exam Expert response:', error);
    return mockAskExamExpert(question, subject, data);
  }
};

export const generatePracticeQuestions = async (
  subject: Subject,
  topic: string,
  data?: ExamPilotData,
  difficulty = 'Normal',
): Promise<PracticeQuestion[]> => {
  try {
    if (data) {
      const guidance = data.guidance.filter((item) => item.subjectId === subject.id).map((item) => item.content).join('\n\n');
      const result = await postJson<{
        questions: Array<{
          topic: string;
          type: PracticeQuestionType;
          prompt: string;
          options: string[];
          answerGuide: string;
          explanation: string;
          markSchemePoints: string[];
        }>;
      }>('/api/generate-quiz', {
        ...contextPayload(data, subject),
        topic,
        guidance,
        difficulty,
      });
      return result.questions.map((question) => ({
        id: id('practice'),
        subjectId: subject.id,
        topic: question.topic || topic,
        type: normalizeQuestionType(question.type),
        prompt: question.prompt,
        options: question.options?.length ? question.options : undefined,
        answerGuide: question.answerGuide,
        explanation: question.explanation,
        markSchemePoints: question.markSchemePoints || [],
        createdAt: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.warn('Falling back to mock quiz generation:', error);
  }
  return mockGeneratePracticeQuestions(subject, topic);
};

const mockAnalyseGuidance = async (subject: Subject, content: string): Promise<AIAnalysis> => {
  const candidates = extractTopicCandidates(content);
  const keyTopics = candidates.length ? candidates.slice(0, 4) : ['Core knowledge', 'Exam technique', 'Definitions', 'Application'];
  return {
    keyTopics,
    subtopics: keyTopics.flatMap((topic) => [`${topic} foundations`, `${topic} exam application`]).slice(0, 8),
    priorityAreas: [
      `${subject.name}: weakest high-mark areas`,
      subject.priority === 'Critical' ? 'Immediate exam practice' : 'Secure recall before timed questions',
      'Questions where command words change the answer style',
    ],
    examQuestionTypes: ['short structured questions', 'extended response', 'data or source interpretation', 'method/evaluation prompts'],
    suggestedRevisionTasks: [
      `Make a one-page ${subject.name} retrieval sheet`,
      'Complete 30 minutes of targeted exam questions',
      'Mark with the scheme and log any repeated mistakes',
      'Turn missed points into flashcards',
    ],
    likelyWeakAreas: keyTopics.slice(0, 3).map((topic) => `${topic} under timed conditions`),
  };
};

const mockGenerateTimetable = async (data: ExamPilotData, mode: TimetableMode): Promise<TimetableSession[]> => {
  const minutes = mode === 'Light' ? 30 : mode === 'Panic' ? 70 : 45;
  const limit = mode === 'Light' ? 3 : mode === 'Panic' ? 7 : 5;
  const sorted = [...data.subjects].sort((a, b) => {
    const priority = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    return priority[b.priority] - priority[a.priority] || a.examDate.localeCompare(b.examDate);
  });

  return sorted.slice(0, limit).map((subject, index) => {
    const weak = data.weakTopics.find((topic) => topic.subjectId === subject.id)?.topic;
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(index / 2));
    return {
      id: id('session'),
      subjectId: subject.id,
      title: `${subject.name}: ${weak ?? 'priority review'}`,
      type: 'revision',
      date: date.toISOString().slice(0, 10),
      startTime: index % 2 === 0 ? '17:30' : '20:00',
      durationMinutes: minutes,
      mode,
      status: 'planned',
      topic: weak ?? 'Priority review',
      reason: `${subject.priority} priority, exam on ${subject.examDate}, confidence ${subject.confidence}/5.`,
    };
  });
};

const mockGenerateFlashcards = async (subject: Subject, guidance: string): Promise<Flashcard[]> => {
  const topics = extractTopicCandidates(guidance).slice(0, 6);
  const seeds = topics.length ? topics : ['definitions', 'exam technique', 'key process'];
  return seeds.map((topic) => ({
    id: id('card'),
    subjectId: subject.id,
    topic,
    question: `Explain ${topic} in ${subject.name} as if answering a GCSE/IGCSE mark scheme.`,
    answer: 'Include a precise definition, one key detail, and how it appears in an exam question.',
    difficulty: 'Good',
    nextReview: today(),
    createdAt: new Date().toISOString(),
  }));
};

const mockAskExamExpert = async (question: string, subject: Subject | undefined, data: ExamPilotData): Promise<string> => {
  const weak = data.weakTopics
    .filter((topic) => !subject || topic.subjectId === subject.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((topic) => topic.topic);
  const dueCards = data.flashcards.filter((card) => card.nextReview <= today() && (!subject || card.subjectId === subject.id)).length;
  const context = subject
    ? `${subject.name}, exam ${subject.examDate}, confidence ${subject.confidence}/5`
    : `${data.subjects.length} subjects`;

  return [
    `Using context: ${context}.`,
    weak.length ? `Main weak areas I can see: ${weak.join(', ')}.` : 'No weak topics are logged yet, so I would start by diagnosing one small topic.',
    dueCards ? `${dueCards} flashcard${dueCards === 1 ? '' : 's'} are due, so begin with retrieval before notes.` : 'No flashcards are due right now.',
    `For your question, "${question}", revise in this order: 1) recall the core facts without notes, 2) answer one exam-style prompt, 3) mark it strictly, 4) convert any lost marks into a task or flashcard.`,
  ].join('\n\n');
};

const mockGeneratePracticeQuestions = async (subject: Subject, topic: string): Promise<PracticeQuestion[]> => {
  const createdAt = new Date().toISOString();
  return [
    {
      id: id('practice'),
      subjectId: subject.id,
      topic,
      type: 'multiple-choice',
      prompt: `Which statement best describes ${topic}?`,
      options: ['A precise definition', 'A vague example', 'An unrelated process', 'A common misconception'],
      answerGuide: 'Choose the option closest to the mark-scheme definition and justify it.',
      explanation: 'This checks whether you can distinguish markable precision from vague recognition.',
      markSchemePoints: ['Precise definition', 'Relevant example', 'No unrelated detail'],
      createdAt,
    },
    {
      id: id('practice'),
      subjectId: subject.id,
      topic,
      type: 'short-answer',
      prompt: `Give two exam-relevant points about ${topic}.`,
      answerGuide: 'Two specific, markable points with no filler.',
      explanation: 'Short-answer marks usually reward concise points rather than long paragraphs.',
      markSchemePoints: ['Point 1 is accurate', 'Point 2 is distinct', 'Uses correct terminology'],
      createdAt,
    },
    {
      id: id('practice'),
      subjectId: subject.id,
      topic,
      type: 'exam-style',
      prompt: `Explain ${topic} using a structured GCSE/IGCSE answer.`,
      answerGuide: 'Define the idea, apply it to the scenario, and use the correct command-word style.',
      explanation: 'This practises turning knowledge into an answer that earns marks under exam conditions.',
      markSchemePoints: ['Definition', 'Application', 'Clear causal link or evaluation'],
      createdAt,
    },
  ];
};

function inferAvailableTime(mode: TimetableMode) {
  if (mode === 'Light') return 'Short sessions of 25-35 minutes, preserving rest and commitments.';
  if (mode === 'Panic') return 'Focused sessions of 50-75 minutes, prioritising urgent weak areas without removing meals or sleep.';
  return 'Balanced sessions of 40-50 minutes around fixed school commitments.';
}

function sanitizeSessions(sessions: Array<Partial<TimetableSession>>, mode: TimetableMode): TimetableSession[] {
  return sessions
    .filter((session) => session.title && session.date && session.startTime)
    .map((session) => ({
      id: id('session'),
      subjectId: session.subjectId,
      title: String(session.title),
      type: session.type || 'revision',
      date: String(session.date),
      startTime: String(session.startTime),
      durationMinutes: Number(session.durationMinutes || 45),
      mode: session.mode || mode,
      status: 'planned',
      topic: session.topic || 'Priority review',
      reason: session.reason || 'Generated from exam date, priority, confidence, and weak-topic context.',
    }));
}

function normalizeDifficulty(value: unknown): FlashcardDifficulty {
  return value === 'Again' || value === 'Hard' || value === 'Easy' ? value : 'Good';
}

function normalizeQuestionType(value: unknown): PracticeQuestionType {
  if (value === 'multiple-choice' || value === 'short-answer' || value === 'definition' || value === 'exam-style' || value === 'essay-plan') {
    return value;
  }
  return 'exam-style';
}
