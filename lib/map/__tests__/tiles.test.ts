/**
 * El basemap es ENV-CONDICIONAL: con `EXPO_PUBLIC_TILES_URL` usamos nuestro
 * estilo Protomaps + atribución OSM/Protomaps; sin ella, OpenFreeMap online.
 * El env se lee EN CADA LLAMADA, así que estos tests lo mutan directamente.
 */
import {
  ATTRIBUTION_ONLINE,
  ATTRIBUTION_OURS,
  getTilesBaseUrl,
  mapAttribution,
  mapStyleURL,
  ONLINE_STYLE_URL,
  STYLE_FILENAME,
  tilesEnabled,
} from '../tiles';

const ENV_KEY = 'EXPO_PUBLIC_TILES_URL';
const ORIGINAL = process.env[ENV_KEY];

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL;
});

describe('sin EXPO_PUBLIC_TILES_URL (comportamiento de HOY, sin infra)', () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  it('tiles deshabilitados: estilo online de OpenFreeMap y atribución online', () => {
    expect(getTilesBaseUrl()).toBeNull();
    expect(tilesEnabled()).toBe(false);
    expect(mapStyleURL()).toBe(ONLINE_STYLE_URL);
    expect(mapAttribution()).toBe(ATTRIBUTION_ONLINE);
  });

  it('cadena vacía o solo espacios NO habilita', () => {
    process.env[ENV_KEY] = '   ';
    expect(tilesEnabled()).toBe(false);
    expect(mapStyleURL()).toBe(ONLINE_STYLE_URL);
  });
});

describe('con EXPO_PUBLIC_TILES_URL (infra desplegada)', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = 'https://tiles.locallist.ai';
  });

  it('habilita: estilo Protomaps y atribución OSM + Protomaps', () => {
    expect(tilesEnabled()).toBe(true);
    expect(mapStyleURL()).toBe(`https://tiles.locallist.ai/styles/${STYLE_FILENAME}`);
    expect(mapAttribution()).toBe(ATTRIBUTION_OURS);
    // La atribución obligatoria de OSM SIEMPRE presente.
    expect(mapAttribution()).toContain('OpenStreetMap contributors');
  });

  it('normaliza la barra final para no duplicarla en la URL del estilo', () => {
    process.env[ENV_KEY] = 'https://tiles.locallist.ai/';
    expect(mapStyleURL()).toBe(`https://tiles.locallist.ai/styles/${STYLE_FILENAME}`);
    expect(getTilesBaseUrl()).toBe('https://tiles.locallist.ai');
  });
});
