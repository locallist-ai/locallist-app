import { computeBounds, recenterMode, resolveCameraTarget } from '../camera';

describe('computeBounds', () => {
  it('sin stops devuelve centro [0,0] y sin bounds', () => {
    expect(computeBounds([])).toEqual({ center: [0, 0] });
  });

  it('calcula centro (punto medio) y bounds ne/sw de varios stops', () => {
    const bounds = computeBounds([
      { latitude: 40.0, longitude: -3.0 },
      { latitude: 42.0, longitude: -1.0 },
    ]);
    expect(bounds.center).toEqual([-2.0, 41.0]);
    expect(bounds.bounds).toEqual({ ne: [-1.0, 42.0], sw: [-3.0, 40.0] });
  });
});

describe('resolveCameraTarget', () => {
  const userCoordinate = { latitude: 10, longitude: 20 };
  const activeStop = { latitude: 30, longitude: 40 };

  it("'stop' apunta al stop activo", () => {
    expect(resolveCameraTarget('stop', { userCoordinate, activeStop })).toBe(activeStop);
  });

  it("'user' apunta al usuario cuando hay ubicación", () => {
    expect(resolveCameraTarget('user', { userCoordinate, activeStop })).toBe(userCoordinate);
  });

  it("'user' sin ubicación cae al stop activo", () => {
    expect(resolveCameraTarget('user', { userCoordinate: null, activeStop })).toBe(activeStop);
  });

  it("'free' no mueve la cámara (null)", () => {
    expect(resolveCameraTarget('free', { userCoordinate, activeStop })).toBeNull();
  });
});

describe('recenterMode', () => {
  it('sigue al usuario si hay ubicación, si no al stop', () => {
    expect(recenterMode(true)).toBe('user');
    expect(recenterMode(false)).toBe('stop');
  });
});
