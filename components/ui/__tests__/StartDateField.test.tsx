/**
 * Tests de `StartDateField` + `DatePickerSheet` — captura de la fecha de inicio.
 *
 * Foco: el campo muestra la fecha seleccionada (localizada), abre el calendario
 * y al tocar un día dentro de rango llama onChange con la fecha en `yyyy-MM-dd`.
 * Los días fuera de rango (< min) están deshabilitados y no disparan onChange.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { StartDateField } from '../StartDateField';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('StartDateField', () => {
  it('muestra la fecha seleccionada localizada e incluye el año', () => {
    render(
      <StartDateField value="2026-07-15" onChange={jest.fn()} minIso="2026-07-01" maxIso="2027-07-01" />,
    );
    const field = screen.getByTestId('start-date-field');
    // La fecha localizada del trigger contiene el año.
    expect(field).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('abre el calendario y al elegir un día llama onChange con yyyy-MM-dd', () => {
    const onChange = jest.fn();
    render(
      <StartDateField value="2026-07-15" onChange={onChange} minIso="2026-07-01" maxIso="2027-07-01" />,
    );

    fireEvent.press(screen.getByTestId('start-date-field'));
    // El calendario abre en el mes del valor → julio 2026.
    fireEvent.press(screen.getByTestId('date-cell-2026-07-20'));

    expect(onChange).toHaveBeenCalledWith('2026-07-20');
  });

  it('un día anterior al mínimo está deshabilitado y no dispara onChange', () => {
    const onChange = jest.fn();
    render(
      <StartDateField value="2026-07-15" onChange={onChange} minIso="2026-07-10" maxIso="2027-07-01" />,
    );

    fireEvent.press(screen.getByTestId('start-date-field'));
    // 5 jul < min (10 jul) → deshabilitado.
    fireEvent.press(screen.getByTestId('date-cell-2026-07-05'));

    expect(onChange).not.toHaveBeenCalled();
  });

  // m1: la ruta por DEFECTO (sin minIso/maxIso → usa `defaultMax()`). Con la
  // aritmética antigua `y+1` misma MM-dd, hoy=29-feb-2028 → maxIso="2029-02-29"
  // (inexistente) → `monthIndex` hacía `parseIsoDate(iso)!` → `null.getFullYear()`
  // → TypeError al ABRIR el picker (crash para TODOS ese día). Con `addDaysIso`
  // el max es 2029-02-28 y el picker abre sin crash.
  describe('m1: abre en año bisiesto (29-feb) por la ruta defaultMax() sin crash', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2028, 1, 29)); // 29 feb 2028 (bisiesto)
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('no crashea al abrir y permite seleccionar el día de hoy (29-feb)', () => {
      const onChange = jest.fn();
      // SIN minIso/maxIso → ejercita defaultMax()/todayIso() reales (el crash).
      render(<StartDateField value="2028-02-29" onChange={onChange} />);

      // Abrir el picker: antes del fix, este render interno lanzaba TypeError.
      fireEvent.press(screen.getByTestId('start-date-field'));

      // El calendario abrió en el mes del valor (feb 2028) y renderizó el día.
      const todayCell = screen.getByTestId('date-cell-2028-02-29');
      expect(todayCell).toBeTruthy();

      fireEvent.press(todayCell);
      expect(onChange).toHaveBeenCalledWith('2028-02-29');
    });
  });
});
