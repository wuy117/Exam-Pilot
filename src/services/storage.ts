import { emptyData } from '../data/sampleData';
import type { ExamPilotData } from '../types';

const STORAGE_KEY = 'exampilot:data:v1';

export const loadData = (): ExamPilotData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    return normalizeData(JSON.parse(raw));
  } catch {
    return emptyData;
  }
};

export const saveData = (data: ExamPilotData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('ExamPilot could not save to localStorage:', error);
  }
};

export const exportData = (data: ExamPilotData) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `exampilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importData = async (file: File): Promise<ExamPilotData> => {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<ExamPilotData>;
  return normalizeData(parsed);
};

const normalizeData = (parsed: Partial<ExamPilotData>): ExamPilotData => ({
  ...emptyData,
  ...parsed,
  subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
  guidance: Array.isArray(parsed.guidance) ? parsed.guidance : [],
  knowledgeDocuments: Array.isArray(parsed.knowledgeDocuments) ? parsed.knowledgeDocuments : [],
  topics: Array.isArray(parsed.topics) ? parsed.topics : [],
  topicMastery: Array.isArray(parsed.topicMastery) ? parsed.topicMastery : [],
  sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
  practiceQuestions: Array.isArray(parsed.practiceQuestions) ? parsed.practiceQuestions : [],
  pastPaperItems: Array.isArray(parsed.pastPaperItems) ? parsed.pastPaperItems : [],
  weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics : [],
  aiMessages: Array.isArray(parsed.aiMessages) ? parsed.aiMessages : [],
});
