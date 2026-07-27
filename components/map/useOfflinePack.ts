// Hook de UX para el pack offline del plan en Follow Mode.
//
// En contexto de follow y con la infra de tiles habilitada (`EXPO_PUBLIC_TILES_URL`),
// asegura el pack offline del plan actual y expone su estado para pintar un
// indicador de progreso. Degrada a ONLINE (status `idle`, sin ruido) cuando los
// tiles no están habilitados o el módulo nativo offline no existe: el `MapView`
// sigue funcionando contra el basemap online.

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { tilesEnabled } from '../../lib/map/tiles';
import {
  computeBounds,
  deletePack,
  ensurePack,
  evictLRU,
  getPackStatus,
  unsubscribePack,
  type OfflinePackLike,
  type OfflinePackStatusLike,
  type OfflineStop,
} from '../../lib/map/offline-packs';

export type OfflinePackUiStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface UseOfflinePack {
  /** `idle` = sin offline (deshabilitado o degradado a online). */
  status: OfflinePackUiStatus;
  /** 0-100. Solo significativo mientras `downloading`. */
  percentage: number;
  /** Reintenta la descarga (borra el pack roto y recrea). */
  retry: () => void;
}

/**
 * @param planId  Plan cuyo mapa empaquetar. `undefined` = no-op.
 * @param stops   Stops del día/plan (para el bbox). Vacío = no-op.
 * @param enabled Contexto de follow. La descarga solo ocurre con `enabled`.
 */
export function useOfflinePack(
  planId: string | undefined,
  stops: OfflineStop[],
  enabled: boolean,
): UseOfflinePack {
  const [status, setStatus] = useState<OfflinePackUiStatus>('idle');
  const [percentage, setPercentage] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  const active = enabled && tilesEnabled() && !!planId && stops.length > 0;

  // Clave estable del bbox: evita re-ejecutar el efecto por cada nueva REF del
  // array `stops` cuando las coordenadas no han cambiado.
  const boundsKey = active
    ? JSON.stringify(stops.map((s) => [s.latitude, s.longitude]))
    : '';

  const retry = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!active || !planId) {
      setStatus('idle');
      setPercentage(0);
      return;
    }

    const bounds = computeBounds(stops);
    if (!bounds) {
      setStatus('idle');
      return;
    }

    let cancelled = false;

    const onProgress = (_pack: OfflinePackLike, s: OfflinePackStatusLike) => {
      if (cancelled) return;
      setPercentage(Math.round(s.percentage));
      setStatus(s.percentage >= 100 ? 'ready' : 'downloading');
    };
    const onError = (_pack: OfflinePackLike, err: { name: string; message: string }) => {
      if (cancelled) return;
      logger.warn('offline pack download error', err);
      setStatus('error');
    };

    setStatus('downloading');
    setPercentage(0);

    void (async () => {
      // Retry tras error: borra el pack roto antes de recrear.
      if (retryNonce > 0) await deletePack(planId).catch(() => undefined);

      const result = await ensurePack(planId, bounds, { onProgress, onError });
      if (cancelled) return;

      if (result === 'disabled' || result === 'unavailable') {
        setStatus('idle'); // degrada a online, sin indicador
        return;
      }
      if (result === 'error') {
        setStatus('error');
        return;
      }
      if (result === 'exists') {
        // Un pack ya COMPLETO no vuelve a emitir progreso: consulta su status.
        const st = await getPackStatus(planId);
        if (cancelled) return;
        if (st) {
          setPercentage(Math.round(st.percentage));
          setStatus(st.percentage >= 100 ? 'ready' : 'downloading');
        } else {
          setStatus('downloading');
        }
      }
      // 'created' → sigue 'downloading'; los listeners actualizan el progreso.

      void evictLRU().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
      unsubscribePack(planId);
    };
    // boundsKey codifica `stops`; planId/active/retryNonce son los disparadores reales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, planId, boundsKey, retryNonce]);

  return { status, percentage, retry };
}
