import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildGeoUrl,
  resolveHandoffTargets,
} from '../handoff';

const coord = { latitude: 40.4168, longitude: -3.7038 };

describe('handoff URL builders', () => {
  it('Apple Maps: destino + modo a pie (dirflg=w)', () => {
    expect(buildAppleMapsUrl(coord)).toBe(
      'http://maps.apple.com/?daddr=40.4168,-3.7038&dirflg=w',
    );
  });

  it('Google Maps: scheme propio + navegación a pie', () => {
    expect(buildGoogleMapsUrl(coord)).toBe(
      'comgooglemaps://?daddr=40.4168,-3.7038&directionsmode=walking',
    );
  });

  it('geo: fallback universal', () => {
    expect(buildGeoUrl(coord)).toBe('geo:40.4168,-3.7038');
  });

  it('formatea con punto decimal, acota a 6 decimales y preserva el signo', () => {
    // 40.41681234 -> toFixed(6) = 40.416812 ; -3.7 se mantiene sin ceros de cola.
    expect(buildGeoUrl({ latitude: 40.41681234, longitude: -3.7 })).toBe(
      'geo:40.416812,-3.7',
    );
  });

  it('coordenadas no finitas caen a 0 sin romper la URL', () => {
    expect(buildGeoUrl({ latitude: Number.NaN, longitude: Number.POSITIVE_INFINITY })).toBe(
      'geo:0,0',
    );
  });
});

describe('resolveHandoffTargets', () => {
  it('sin Google instalado ofrece SOLO Apple Maps', () => {
    const targets = resolveHandoffTargets(coord, false);
    expect(targets).toHaveLength(1);
    expect(targets[0].provider).toBe('apple');
  });

  it('con Google instalado ofrece Apple primero y Google después', () => {
    const targets = resolveHandoffTargets(coord, true);
    expect(targets.map((t) => t.provider)).toEqual(['apple', 'google']);
    expect(targets[1].url).toBe(buildGoogleMapsUrl(coord));
  });
});
