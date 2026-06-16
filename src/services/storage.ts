import { emptyData } from '../data/sampleData';
import type { ExamPilotData } from '../types';

const STORAGE_KEY = 'exampilot:data:v1';

export const loadData = (): ExamPilotData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    return { ...emptyData, ...JSON.parse(raw) };
  } catch {
    return emptyData;
  }
};

export const saveData = (data: ExamPilotData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  return { ...emptyData, ...parsed };
};
