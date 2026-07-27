/**
 * CandidateRow — matched rows are selectable checkboxes, non-matched rows are
 * shown for honesty but disabled. Each assertion fails against a mutation that
 * drops the matched/selected distinction.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CandidateRow } from '../CandidateRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const matched = {
  name: 'Place A',
  matchedPlaceId: 'p1',
  matchedPlaceName: 'Place A',
  matchConfidence: 'high' as const,
};
const unmatched = { name: 'Unknown Bar' };

it('fila con match: seleccionable, muestra badge de confianza, toggle dispara onToggle con el id', () => {
  const onToggle = jest.fn();
  render(<CandidateRow candidate={matched} index={0} selected onToggle={onToggle} />);

  const row = screen.getByTestId('candidate-0');
  expect(row.props.accessibilityState.checked).toBe(true);
  expect(row.props.accessibilityState.disabled).toBe(false);
  expect(screen.getByText('import.matchedBadgeHigh')).toBeTruthy();

  fireEvent.press(row);
  expect(onToggle).toHaveBeenCalledWith('p1');
});

it('fila seleccionada vs no seleccionada refleja el estado checked', () => {
  const { rerender } = render(
    <CandidateRow candidate={matched} index={0} selected={false} onToggle={jest.fn()} />,
  );
  expect(screen.getByTestId('candidate-0').props.accessibilityState.checked).toBe(false);

  rerender(<CandidateRow candidate={matched} index={0} selected onToggle={jest.fn()} />);
  expect(screen.getByTestId('candidate-0').props.accessibilityState.checked).toBe(true);
});

it('fila sin match: deshabilitada, "not on LocalList", no dispara onToggle', () => {
  const onToggle = jest.fn();
  render(<CandidateRow candidate={unmatched} index={1} selected={false} onToggle={onToggle} />);

  const row = screen.getByTestId('candidate-1');
  expect(row.props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText('import.notOnLocalList')).toBeTruthy();

  fireEvent.press(row);
  expect(onToggle).not.toHaveBeenCalled();
});
