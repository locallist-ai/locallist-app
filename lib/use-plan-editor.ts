import { useReducer, useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Place, PlanStop, PlanDetailResponse, StopInput } from './types';

export type DayGroup = {
  dayNumber: number;
  stops: (PlanStop & { id?: string })[];
};

type State = {
  days: DayGroup[];
  isDirty: boolean;
  isSaving: boolean;
};

type Action =
  | { type: 'INIT'; days: DayGroup[] }
  | { type: 'REORDER'; dayNumber: number; from: number; to: number }
  | { type: 'DELETE_STOP'; dayNumber: number; stopIndex: number }
  | { type: 'MOVE_TO_DAY'; fromDay: number; stopIndex: number; toDay: number }
  | { type: 'ADD_STOP'; dayNumber: number; place: Place }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'MARK_SAVED' };

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

function recalcOrderIndices(days: DayGroup[]): DayGroup[] {
  return days.map((day) => ({
    ...day,
    stops: day.stops.map((stop, idx) => ({ ...stop, orderIndex: idx })),
  }));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return { days: action.days, isDirty: false, isSaving: false };

    case 'REORDER': {
      const days = state.days.map((day) => {
        if (day.dayNumber !== action.dayNumber) return day;
        return { ...day, stops: reorderArray(day.stops, action.from, action.to) };
      });
      return { ...state, days: recalcOrderIndices(days), isDirty: true };
    }

    case 'DELETE_STOP': {
      const days = state.days.map((day) => {
        if (day.dayNumber !== action.dayNumber) return day;
        const stops = [...day.stops];
        stops.splice(action.stopIndex, 1);
        return { ...day, stops };
      });
      return { ...state, days: recalcOrderIndices(days), isDirty: true };
    }

    case 'MOVE_TO_DAY': {
      const sourceDay = state.days.find((d) => d.dayNumber === action.fromDay);
      if (!sourceDay || action.stopIndex >= sourceDay.stops.length) return state;

      const movedStop: PlanStop & { id?: string } = {
        ...sourceDay.stops[action.stopIndex],
        dayNumber: action.toDay,
      };

      let days = state.days.map((day) => {
        if (day.dayNumber !== action.fromDay) return day;
        const stops = [...day.stops];
        stops.splice(action.stopIndex, 1);
        return { ...day, stops };
      });

      const targetExists = days.some((d) => d.dayNumber === action.toDay);
      if (targetExists) {
        days = days.map((day) => {
          if (day.dayNumber !== action.toDay) return day;
          return { ...day, stops: [...day.stops, movedStop] };
        });
      } else {
        days = [...days, { dayNumber: action.toDay, stops: [movedStop] }];
        days.sort((a, b) => a.dayNumber - b.dayNumber);
      }

      days = days.filter((d) => d.stops.length > 0);
      return { ...state, days: recalcOrderIndices(days), isDirty: true };
    }

    case 'ADD_STOP': {
      const newStop: PlanStop & { id?: string } = {
        placeId: action.place.id,
        dayNumber: action.dayNumber,
        orderIndex: 0,
        timeBlock: null,
        suggestedArrival: null,
        suggestedDurationMin: 45,
        travelFromPrevious: null,
        place: action.place,
      };

      const targetExists = state.days.some((d) => d.dayNumber === action.dayNumber);
      let days: DayGroup[];

      if (targetExists) {
        days = state.days.map((day) => {
          if (day.dayNumber !== action.dayNumber) return day;
          return { ...day, stops: [...day.stops, newStop] };
        });
      } else {
        days = [...state.days, { dayNumber: action.dayNumber, stops: [newStop] }];
        days.sort((a, b) => a.dayNumber - b.dayNumber);
      }

      return { ...state, days: recalcOrderIndices(days), isDirty: true };
    }

    case 'SET_SAVING':
      return { ...state, isSaving: action.value };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, isSaving: false };

    default:
      return state;
  }
}

type NewPlanConfig = {
  name: string;
  city: string;
  durationDays: number;
};

export function usePlanEditor(planId: string, newPlanConfig?: NewPlanConfig) {
  const isNew = planId === 'new';

  const [state, dispatch] = useReducer(reducer, {
    days: [],
    isDirty: false,
    isSaving: false,
  });

  const [plan, setPlan] = useState<PlanDetailResponse | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  // Initialize: fetch existing plan or create local empty plan
  useEffect(() => {
    if (isNew && newPlanConfig) {
      const totalDays = newPlanConfig.durationDays;
      const days: DayGroup[] = Array.from({ length: totalDays }, (_, i) => ({
        dayNumber: i + 1,
        stops: [],
      }));
      setPlan({
        id: 'new',
        name: newPlanConfig.name,
        city: newPlanConfig.city,
        type: 'custom',
        description: null,
        durationDays: totalDays,
        tripContext: null,
        isPublic: false,
        days: [],
      });
      dispatch({ type: 'INIT', days });
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await api<PlanDetailResponse>(`/plans/${planId}`);
      if (cancelled) return;
      if (res.data) {
        setPlan(res.data);
        const apiDays = res.data.days.map((d) => ({
          dayNumber: d.dayNumber,
          stops: d.stops.sort((a, b) => a.orderIndex - b.orderIndex),
        }));
        const totalDays = res.data.durationDays ?? 1;
        const days: DayGroup[] = [];
        for (let i = 1; i <= totalDays; i++) {
          const existing = apiDays.find((d) => d.dayNumber === i);
          days.push(existing ?? { dayNumber: i, stops: [] });
        }
        dispatch({ type: 'INIT', days });
      } else {
        setError(res.error ?? 'Failed to load plan');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [planId, isNew]);

  const save = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    dispatch({ type: 'SET_SAVING', value: true });

    const stops: StopInput[] = state.days.flatMap((day) =>
      day.stops.map((stop) => ({
        placeId: stop.placeId,
        dayNumber: day.dayNumber,
        orderIndex: stop.orderIndex,
        timeBlock: stop.timeBlock,
        suggestedDurationMin: stop.suggestedDurationMin,
      }))
    );

    // New plan: create plan first, then save stops
    if (isNew && !savedPlanId) {
      if (!newPlanConfig) {
        dispatch({ type: 'SET_SAVING', value: false });
        return { success: false, error: 'Missing plan configuration' };
      }

      const createRes = await api<PlanDetailResponse>('/plans', {
        method: 'POST',
        body: {
          name: newPlanConfig.name,
          city: newPlanConfig.city,
          durationDays: newPlanConfig.durationDays,
        },
      });

      if (!createRes.data) {
        dispatch({ type: 'SET_SAVING', value: false });
        return { success: false, error: createRes.error ?? 'Failed to create plan' };
      }

      const newId = createRes.data.id;
      setSavedPlanId(newId);

      if (stops.length > 0) {
        const stopsRes = await api<PlanDetailResponse>(`/plans/${newId}/stops`, {
          method: 'PUT',
          body: { stops },
        });
        if (!stopsRes.data) {
          dispatch({ type: 'SET_SAVING', value: false });
          return { success: false, error: stopsRes.error ?? 'Failed to save stops' };
        }
      }

      dispatch({ type: 'MARK_SAVED' });
      return { success: true };
    }

    // Existing plan: update stops
    const targetId = savedPlanId ?? planId;
    const res = await api<PlanDetailResponse>(`/plans/${targetId}/stops`, {
      method: 'PUT',
      body: { stops },
    });

    if (res.data) {
      dispatch({ type: 'MARK_SAVED' });
      return { success: true };
    } else {
      dispatch({ type: 'SET_SAVING', value: false });
      return { success: false, error: res.error ?? 'Failed to save changes' };
    }
  }, [planId, savedPlanId, isNew, newPlanConfig, state.days]);

  return {
    plan,
    days: state.days,
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    loading,
    error,
    dispatch,
    save,
  };
}
