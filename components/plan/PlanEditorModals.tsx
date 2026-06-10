import React, { createContext, useContext, useMemo, useState } from 'react';
import { MoveToDay } from '../plan-editor/MoveToDay';
import { PlaceSearchModal } from '../plan-editor/PlaceSearchModal';
import { usePlanEditorContext } from './PlanEditorContext';

export type PlanEditorModalControls = {
  requestMove: (fromDay: number, stopIndex: number) => void;
  requestAdd: (dayNumber: number) => void;
  requestReplace: (dayNumber: number, stopIndex: number) => void;
};

const PlanEditorModalsContext = createContext<PlanEditorModalControls | null>(null);

export function usePlanEditorModals(): PlanEditorModalControls {
  const ctx = useContext(PlanEditorModalsContext);
  if (!ctx) {
    throw new Error('usePlanEditorModals must be used within a PlanEditorModalsHost');
  }
  return ctx;
}

type HostProps = {
  city: string;
  totalDays: number;
  children: React.ReactNode;
};

// Hosts the editor modals above the horizontal pager so they are not
// clipped by the paging ScrollView. Owns the open/close state for each modal.
export function PlanEditorModalsHost({ city, totalDays, children }: HostProps) {
  const { dispatch } = usePlanEditorContext();

  const [moveState, setMoveState] = useState({ visible: false, fromDay: 0, stopIndex: 0 });
  const [addState, setAddState] = useState({ visible: false, dayNumber: 1 });
  const [replaceState, setReplaceState] = useState({ visible: false, dayNumber: 1, stopIndex: 0 });

  const controls = useMemo<PlanEditorModalControls>(
    () => ({
      requestMove: (fromDay, stopIndex) => setMoveState({ visible: true, fromDay, stopIndex }),
      requestAdd: (dayNumber) => setAddState({ visible: true, dayNumber }),
      requestReplace: (dayNumber, stopIndex) => setReplaceState({ visible: true, dayNumber, stopIndex }),
    }),
    [],
  );

  return (
    <PlanEditorModalsContext.Provider value={controls}>
      {children}

      <MoveToDay
        visible={moveState.visible}
        currentDay={moveState.fromDay}
        totalDays={totalDays}
        onSelect={(toDay) => {
          dispatch({
            type: 'MOVE_TO_DAY',
            fromDay: moveState.fromDay,
            stopIndex: moveState.stopIndex,
            toDay,
          });
          setMoveState({ ...moveState, visible: false });
        }}
        onClose={() => setMoveState({ ...moveState, visible: false })}
      />
      <PlaceSearchModal
        visible={addState.visible}
        city={city}
        onSelect={(place) => {
          dispatch({ type: 'ADD_STOP', dayNumber: addState.dayNumber, place });
          setAddState({ ...addState, visible: false });
        }}
        onClose={() => setAddState({ ...addState, visible: false })}
      />
      <PlaceSearchModal
        visible={replaceState.visible}
        city={city}
        onSelect={(place) => {
          dispatch({ type: 'REPLACE_STOP', dayNumber: replaceState.dayNumber, stopIndex: replaceState.stopIndex, place });
          setReplaceState({ ...replaceState, visible: false });
        }}
        onClose={() => setReplaceState({ ...replaceState, visible: false })}
      />
    </PlanEditorModalsContext.Provider>
  );
}
