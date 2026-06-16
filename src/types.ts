export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;
export type TimetableMode = 'Light' | 'Normal' | 'Panic';
export type SessionStatus = 'planned' | 'done' | 'skipped';
export type FlashcardDifficulty = 'Again' | 'Hard' | 'Good' | 'Easy';
export type PracticeQuestionType = 'multiple-choice' | 'short-answer' | 'definition' | 'exam-style' | 'essay-plan';
export type PracticeResult = 'correct' | 'partial' | 'incorrect';

export interface Subject {
  id: string;
  name: string;
  examDate: string;
  priority: PriorityLevel;
  confidence: ConfidenceLevel;
  colour: string;
  notes: string;
  createdAt: string;
}

export interface RevisionGuidance {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  analysis?: AIAnalysis;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  subtopics: string[];
  priority: PriorityLevel;
  source: 'manual' | 'ai' | 'practice' | 'flashcard';
}

export interface TimetableSession {
  id: string;
  subjectId?: string;
  title: string;
  type: 'revision' | 'lesson' | 'chapel' | 'meal' | 'music' | 'prep' | 'sport' | 'free-time' | 'exam';
  date: string;
  startTime: string;
  durationMinutes: number;
  mode: TimetableMode;
  status: SessionStatus;
  topic?: string;
  reason?: string;
}

export interface Flashcard {
  id: string;
  subjectId: string;
  topic: string;
  question: string;
  answer: string;
  difficulty: FlashcardDifficulty;
  lastReviewed?: string;
  nextReview: string;
  createdAt: string;
}

export interface PracticeQuestion {
  id: string;
  subjectId: string;
  topic: string;
  type: PracticeQuestionType;
  prompt: string;
  options?: string[];
  answerGuide: string;
  explanation?: string;
  markSchemePoints?: string[];
  result?: PracticeResult;
  createdAt: string;
}

export interface WeakTopic {
  id: string;
  subjectId: string;
  topic: string;
  score: number;
  sources: string[];
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  subjectId?: string;
  contextSummary?: string;
}

export interface AIAnalysis {
  keyTopics: string[];
  subtopics: string[];
  priorityAreas: string[];
  examQuestionTypes: string[];
  suggestedRevisionTasks: string[];
  likelyWeakAreas: string[];
}

export interface ExamPilotData {
  subjects: Subject[];
  guidance: RevisionGuidance[];
  topics: Topic[];
  sessions: TimetableSession[];
  flashcards: Flashcard[];
  practiceQuestions: PracticeQuestion[];
  weakTopics: WeakTopic[];
  aiMessages: AIMessage[];
}
