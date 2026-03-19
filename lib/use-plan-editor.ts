import { useReducer, useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
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
      // Extract the stop from its source day
      const sourceDay = state.days.find((d) => d.dayNumber === action.fromDay);
      if (!sourceDay || action.stopIndex >= sourceDay.stops.length) return state;

      const movedStop: PlanStop & { id?: string } = {
        ...sourceDay.stops[action.stopIndex],
        dayNumber: action.toDay,
      };

      // Remove from source day
      let days = state.days.map((day) => {
        if (day.dayNumber !== action.fromDay) return day;
        const stops = [...day.stops];
        stops.splice(action.stopIndex, 1);
        return { ...day, stops };
      });

      // Add to target day
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

      // Remove empty days
      days = days.filter((d) => d.stops.length > 0);

      return { ...state, days: recalcOrderIndices(days), isDirty: true };
    }

    case 'ADD_STOP': {
      const newStop: PlanStop & { id?: string } = {
        placeId: action.place.id,
        dayNumber: action.dayNumber,
        orderIndex: 0, // will be recalculated
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

export function usePlanEditor(planId: string) {
  const [state, dispatch] = useReducer(reducer, {
    days: [],
    isDirty: false,
    isSaving: false,
  });

  const [plan, setPlan] = useState<PlanDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<PlanDetailResponse>(`/plans/${planId}`);
      if (cancelled) return;
      if (res.data) {
        setPlan(res.data);
        dispatch({
          type: 'INIT',
          days: res.data.days.map((d) => ({
            dayNumber: d.dayNumber,
            stops: d.stops.sort((a, b) => a.orderIndex - b.orderIndex),
          })),
        });
      } else {
        setError(res.error ?? 'Failed to load plan');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [planId]);

  const save = useCallback(async () => {
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

    const res = await api<PlanDetailResponse>(`/plans/${planId}/stops`, {
      method: 'PUT',
      body: { stops },
    });

    if (res.data) {
      dispatch({ type: 'MARK_SAVED' });
      return true;
    } else {
      dispatch({ type: 'SET_SAVING', value: false });
      Alert.alert('Error', res.error ?? 'Failed to save changes');
      return false;
    }
  }, [planId, state.days]);

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
