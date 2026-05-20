import { z } from 'zod';

/** 四象限：q1 重要紧急，q2 重要不紧急，q3 不重要紧急，q4 不重要不紧急 */
export const WorklistQuadrantSchema = z.enum(['q1', 'q2', 'q3', 'q4']);
export type WorklistQuadrant = z.infer<typeof WorklistQuadrantSchema>;

/** 遍历顺序（桌面端实际格子位置由 CSS grid 固定：左上 q2、右上 q1） */
export const WORKLIST_QUADRANT_ORDER: WorklistQuadrant[] = ['q1', 'q2', 'q3', 'q4'];

export type WorklistQuadrantMeta = {
  id: WorklistQuadrant;
  label: string;
  hint: string;
};

export const WORKLIST_QUADRANT_META: Record<WorklistQuadrant, WorklistQuadrantMeta> = {
  q1: { id: 'q1', label: '重要且紧急', hint: '立即处理' },
  q2: { id: 'q2', label: '重要不紧急', hint: '计划安排' },
  q3: { id: 'q3', label: '不重要但紧急', hint: '尽快处理或委派' },
  q4: { id: 'q4', label: '不重要不紧急', hint: '可延后或剔除' },
};

export function normalizeWorklistQuadrant(raw: unknown): WorklistQuadrant {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'q1' || s === 'urgent-important' || s === 'important-urgent') return 'q1';
  if (s === 'q3' || s === 'urgent-not-important') return 'q3';
  if (s === 'q4' || s === 'not-important-not-urgent' || s === 'low') return 'q4';
  if (s === 'q2' || s === 'important-not-urgent') return 'q2';
  return 'q2';
}
