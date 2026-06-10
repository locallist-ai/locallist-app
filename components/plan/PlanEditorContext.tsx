import React, { createContext, useContext, useMemo } from 'react';
import type { DayGroup, EditorAction } from '../../lib/plan/use-plan-editor';

export type PlanEditorContextValue = {
  days: DayGroup[];
  isDirty: boolean;
  isSaving: boolean;
  dispatch: (action: EditorAction) => void;
  save: () => Promise<void>;
};

const PlanEditorContext = createContext<PlanEditorContextValue | null>(null);

type ProviderProps = PlanEditorContextValue & { children: React.ReactNode };

export function PlanEditorProvider({ days, isDirty, isSaving, dispatch, save, children }: ProviderProps) {
  const value = useMemo(
    () => ({ days, isDirty, isSaving, dispatch, save }),
    [days, isDirty, isSaving, dispatch, save],
  );
  return <PlanEditorContext.Provider value={value}>{children}</PlanEditorContext.Provider>;
}

export function usePlanEditorContext(): PlanEditorContextValue {
  const ctx = useContext(PlanEditorContext);
  if (!ctx) {
    throw new Error('usePlanEditorContext must be used within a PlanEditorProvider');
  }
  return ctx;
}
