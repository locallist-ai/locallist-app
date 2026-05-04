import * as safeStore from '../../safe-store';
import { clearResume, getResume, setResume } from '../resume-store';

jest.mock('../../safe-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockStore = safeStore as jest.Mocked<typeof safeStore>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getResume', () => {
  it('devuelve null cuando no hay entrada guardada', async () => {
    mockStore.getItemAsync.mockResolvedValue(null);
    expect(await getResume('plan-1')).toBeNull();
  });

  it('devuelve el estado guardado correctamente', async () => {
    mockStore.getItemAsync.mockResolvedValue(JSON.stringify({ dayNumber: 2, orderIndex: 3 }));
    expect(await getResume('plan-1')).toEqual({ dayNumber: 2, orderIndex: 3 });
  });

  it('devuelve null para JSON malformado', async () => {
    mockStore.getItemAsync.mockResolvedValue('{not json}');
    expect(await getResume('plan-1')).toBeNull();
  });

  it('devuelve null para objeto sin la shape correcta', async () => {
    mockStore.getItemAsync.mockResolvedValue(JSON.stringify({ day: 1 }));
    expect(await getResume('plan-1')).toBeNull();
  });

  it('usa clave de storage aislada por planId', async () => {
    mockStore.getItemAsync.mockResolvedValue(null);
    await getResume('plan-abc');
    expect(mockStore.getItemAsync).toHaveBeenCalledWith('follow:resume:plan-abc');
  });
});

describe('setResume', () => {
  it('persiste dayNumber y orderIndex como JSON', async () => {
    mockStore.setItemAsync.mockResolvedValue(undefined);
    await setResume('plan-1', 3, 1);
    expect(mockStore.setItemAsync).toHaveBeenCalledWith(
      'follow:resume:plan-1',
      JSON.stringify({ dayNumber: 3, orderIndex: 1 }),
    );
  });
});

describe('clearResume', () => {
  it('elimina la entrada del plan', async () => {
    mockStore.deleteItemAsync.mockResolvedValue(undefined);
    await clearResume('plan-1');
    expect(mockStore.deleteItemAsync).toHaveBeenCalledWith('follow:resume:plan-1');
  });
});

describe('aislamiento entre planes', () => {
  it('cada planId tiene su propia clave de storage', async () => {
    const store: Record<string, string> = {};
    mockStore.setItemAsync.mockImplementation(async (k, v) => { store[k] = v; });
    mockStore.getItemAsync.mockImplementation(async (k) => store[k] ?? null);

    await setResume('plan-a', 1, 0);
    await setResume('plan-b', 2, 4);

    expect(await getResume('plan-a')).toEqual({ dayNumber: 1, orderIndex: 0 });
    expect(await getResume('plan-b')).toEqual({ dayNumber: 2, orderIndex: 4 });
  });
});
