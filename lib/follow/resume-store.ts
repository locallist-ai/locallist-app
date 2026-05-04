import * as safeStore from '../safe-store';

const key = (planId: string) => `follow:resume:${planId}`;

type ResumeState = { dayNumber: number; orderIndex: number };

export async function getResume(planId: string): Promise<ResumeState | null> {
  const raw = await safeStore.getItemAsync(key(planId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'dayNumber' in parsed &&
      'orderIndex' in parsed &&
      typeof (parsed as ResumeState).dayNumber === 'number' &&
      typeof (parsed as ResumeState).orderIndex === 'number'
    ) {
      return parsed as ResumeState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setResume(planId: string, dayNumber: number, orderIndex: number): Promise<void> {
  const value: ResumeState = { dayNumber, orderIndex };
  await safeStore.setItemAsync(key(planId), JSON.stringify(value));
}

export async function clearResume(planId: string): Promise<void> {
  await safeStore.deleteItemAsync(key(planId));
}
