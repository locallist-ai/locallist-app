import { useEffect, useState } from 'react';
import { getLocationModule } from '../../lib/map/location-module';
import {
  acquireLocation,
  type Coordinate,
  type LocationModuleLike,
  type LocationStatus,
  type LocationSubscription,
} from '../../lib/map/location';

export interface FollowLocation {
  status: LocationStatus;
  coordinate: Coordinate | null;
}

/**
 * Ubicación en tiempo real para Follow Mode. Pide permiso WhenInUse UNA vez al
 * activarse (`enabled`), y solo entonces arranca el watcher. Degrada con
 * elegancia: sin módulo nativo -> 'unavailable'; permiso denegado -> 'denied'
 * (sin punto azul, sin repetir la petición). El wiring nativo está aislado en
 * `lib/map/*` para poder testearlo sin device.
 */
export function useFollowLocation(enabled: boolean): FollowLocation {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: LocationSubscription | null = null;

    void (async () => {
      const module = getLocationModule() as LocationModuleLike | null;
      const result = await acquireLocation(module, (coord) => {
        if (!cancelled) setCoordinate(coord);
      });
      if (cancelled) {
        result.subscription?.remove();
        return;
      }
      setStatus(result.status);
      subscription = result.subscription;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return { status, coordinate };
}
