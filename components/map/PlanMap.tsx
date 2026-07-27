import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import MapLibreGL, { type MapViewRef, type CameraRef } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { RouteSegment } from '../../lib/types';
import { colors, fonts } from '../../lib/theme';
import { buildRouteGeoJSON } from './route-geojson';
import { splitRouteGeoJSON } from '../../lib/map/route-split';
import {
  computeBounds,
  recenterMode,
  resolveCameraTarget,
  type CameraMode,
  type MapPoint,
} from '../../lib/map/camera';
import { useFollowLocation } from './useFollowLocation';
import { useOfflinePack } from './useOfflinePack';
import { mapAttribution, mapStyleURL, OSM_COPYRIGHT_URL } from '../../lib/map/tiles';

export interface MapStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  /** orderIndex del stop en el plan (para dividir la ruta hecha/pendiente). */
  orderIndex?: number;
}

interface PlanMapProps {
  stops: MapStop[];
  activePinIndex?: number;
  onCameraUpdate?: (center: { latitude: number; longitude: number }) => void;
  /** Callback cuando el usuario tap un pin. Recibe el índice del stop. */
  onPinPress?: (index: number) => void;
  style?: ViewStyle;
  /** Polylines de routing del backend. Cuando estén presentes se usan en lugar de línea recta. */
  routeSegments?: RouteSegment[];
  /** Día activo para filtrar los routeSegments (Follow Mode muestra un día a la vez). */
  activeDayNumber?: number;
  /**
   * Si es `false`, desactiva scroll/zoom del mapa (preview estático). Útil al incrustarlo
   * dentro de un ScrollView vertical, donde los gestos del mapa secuestran el scroll de la página.
   * Por defecto `true` (interactivo, como en Follow Mode).
   */
  interactive?: boolean;
  /**
   * Activa las capacidades de seguimiento de Follow Mode: punto azul del usuario
   * (permiso WhenInUse pedido aquí), botón de recentrar, modos de cámara
   * (stop-focus / seguir al usuario) y ruta hecha vs pendiente. Por defecto
   * `false` (p. ej. el mapa de detalle de un sitio no lo usa).
   */
  followMode?: boolean;
  /**
   * Id del plan en curso. Solo se usa en `followMode` con la infra de tiles
   * habilitada (`EXPO_PUBLIC_TILES_URL`): dispara la descarga del pack offline
   * del plan. Ausente ⇒ sin offline (el mapa sigue online).
   */
  planId?: string;
  /**
   * Stops de TODO el plan (todos los días) SOLO para calcular el bbox del pack
   * offline: el pack debe cubrir el plan entero, no el día visible. Los pines y
   * la ruta siguen usando `stops` (el día activo). Si se omite, cae a `stops`.
   */
  packStops?: MapStop[];
}

export const PlanMap: React.FC<PlanMapProps> = ({
  stops,
  activePinIndex = 0,
  onCameraUpdate,
  onPinPress,
  style,
  routeSegments,
  activeDayNumber,
  interactive = true,
  followMode = false,
  planId,
  packStops,
}) => {
  const { t } = useTranslation();
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const scaleAnim = useSharedValue(1);

  const { status: locationStatus, coordinate: userCoordinate } = useFollowLocation(followMode);
  const [cameraMode, setCameraMode] = useState<CameraMode>('stop');

  // Descarga del pack offline del plan (solo en follow con infra de tiles). El
  // bbox del pack cubre TODO el plan (`packStops`), no solo el día visible.
  const offline = useOfflinePack(planId, packStops ?? stops, followMode);

  const showUserDot = followMode && locationStatus === 'granted' && userCoordinate !== null;

  // Pulsing animation for active pin
  useEffect(() => {
    scaleAnim.value = withRepeat(
      withSpring(1.3, { damping: 10, mass: 1 }),
      -1,
      true
    );
  }, [scaleAnim]);

  const activeStop = useMemo<MapPoint | null>(() => {
    if (stops.length === 0 || activePinIndex >= stops.length) return null;
    const s = stops[activePinIndex];
    return { latitude: s.latitude, longitude: s.longitude };
  }, [stops, activePinIndex]);

  const flyTo = useCallback((point: MapPoint) => {
    cameraRef.current?.flyTo([point.longitude, point.latitude], 1500);
    onCameraUpdate?.({ latitude: point.latitude, longitude: point.longitude });
  }, [onCameraUpdate]);

  // Fly to active pin when it changes. Cambiar de stop (tap en pin o navegación
  // en la hoja) re-asienta el foco en el stop, por encima de un follow-user o de
  // un pan libre previo — el botón de recentrar vuelve a seguir al usuario.
  useEffect(() => {
    if (!activeStop) return;
    if (followMode) setCameraMode('stop');
    flyTo(activeStop);
  }, [activePinIndex, activeStop, followMode, flyTo]);

  // En modo "seguir al usuario", la cámara persigue el punto azul.
  useEffect(() => {
    if (!followMode || cameraMode !== 'user' || !userCoordinate) return;
    cameraRef.current?.flyTo([userCoordinate.longitude, userCoordinate.latitude], 800);
  }, [followMode, cameraMode, userCoordinate]);

  const handleRecenter = useCallback(() => {
    const mode = recenterMode(userCoordinate !== null);
    setCameraMode(mode);
    const target = resolveCameraTarget(mode, { userCoordinate, activeStop });
    if (target) flyTo(target);
  }, [userCoordinate, activeStop, flyTo]);

  // Si el usuario mueve el mapa a mano, no le secuestramos la cámara hasta que
  // pulse recentrar.
  const handleRegionWillChange = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, { isUserInteraction: boolean }>) => {
      if (followMode && feature?.properties?.isUserInteraction) {
        setCameraMode('free');
      }
    },
    [followMode],
  );

  const { center, bounds } = computeBounds(stops);

  const activeOrderIndex = stops[activePinIndex]?.orderIndex ?? activePinIndex;

  const routeGeoJSON = useMemo<GeoJSON.GeoJSON>(
    () => buildRouteGeoJSON(stops, routeSegments, activeDayNumber),
    [stops, routeSegments, activeDayNumber],
  );

  const routeSplit = useMemo(
    () =>
      followMode
        ? splitRouteGeoJSON(stops, routeSegments, activeDayNumber, activeOrderIndex)
        : null,
    [followMode, stops, routeSegments, activeDayNumber, activeOrderIndex],
  );

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyleURL()}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onRegionWillChange={followMode ? handleRegionWillChange : undefined}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          centerCoordinate={center as [number, number]}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={1500}
        />

        {/* Route line: en Follow Mode se divide en hecho (atenuado) vs pendiente
            (destacado); fuera, una sola línea como siempre. */}
        {stops.length > 1 && followMode && routeSplit ? (
          <>
            <MapLibreGL.ShapeSource id="routeTraveled" shape={routeSplit.traveled}>
              <MapLibreGL.LineLayer
                id="routeTraveledLine"
                style={{ lineColor: '#94a3b8', lineWidth: 3, lineOpacity: 0.45 }}
              />
            </MapLibreGL.ShapeSource>
            <MapLibreGL.ShapeSource id="routeUpcoming" shape={routeSplit.upcoming}>
              <MapLibreGL.LineLayer
                id="routeUpcomingLine"
                style={{ lineColor: '#3b82f6', lineWidth: 4, lineOpacity: 0.9 }}
              />
            </MapLibreGL.ShapeSource>
          </>
        ) : stops.length > 1 ? (
          <MapLibreGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{ lineColor: '#3b82f6', lineWidth: 3, lineOpacity: 0.6 }}
            />
          </MapLibreGL.ShapeSource>
        ) : null}

        {/* Stop pins — numbered circles. The number is the 1-based position of
            the stop within the day being shown (`stops` arrives day-scoped and
            already sorted by orderIndex), so it mirrors the "N / M" the sheet
            shows. The active stop is highlighted (filled sunsetOrange, larger,
            paperWhite number); the rest read as a light secondary marker. */}
        {stops.map((stop, index) => {
          const isActive = index === activePinIndex;
          const stopNumber = index + 1;
          return (
            <MapLibreGL.PointAnnotation
              key={stop.id}
              id={stop.id}
              coordinate={[stop.longitude, stop.latitude]}
              onSelected={onPinPress ? () => onPinPress(index) : undefined}
            >
              <View
                testID={`plan-map-pin-${index}`}
                style={[styles.pin, isActive ? styles.pinActive : styles.pinInactive]}
              >
                <Text
                  testID={`plan-map-pin-label-${index}`}
                  style={[styles.pinLabel, isActive ? styles.pinLabelActive : styles.pinLabelInactive]}
                  allowFontScaling={false}
                >
                  {stopNumber}
                </Text>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}

        {/* Punto azul del usuario (solo con permiso concedido). */}
        {showUserDot && userCoordinate && (
          <MapLibreGL.PointAnnotation
            id="user-location"
            coordinate={[userCoordinate.longitude, userCoordinate.latitude]}
          >
            <View style={styles.userDotHalo}>
              <View style={styles.userDotCore} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>

      {followMode && (
        <Pressable
          onPress={handleRecenter}
          style={styles.recenterButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.recenterMap')}
        >
          <MaterialCommunityIcons
            name={cameraMode === 'user' ? 'crosshairs-gps' : 'crosshairs'}
            size={22}
            color={colors.sunsetOrange}
          />
        </Pressable>
      )}

      {/* Indicador del pack offline: solo en follow y solo cuando hay algo que
          mostrar (descargando / listo / error). En `idle` (sin infra o degradado
          a online) no se pinta nada. */}
      {followMode && offline.status !== 'idle' && (
        <View style={styles.offlinePill} pointerEvents="box-none">
          {offline.status === 'downloading' && (
            <>
              <ActivityIndicator size="small" color={colors.deepOcean} />
              <Text style={styles.offlineText}>
                {t('follow.offlineDownloading')} {t('follow.offlinePercent', { percentage: offline.percentage })}
              </Text>
            </>
          )}
          {offline.status === 'ready' && (
            <>
              <MaterialCommunityIcons name="cloud-check-outline" size={16} color={colors.deepOcean} />
              <Text style={styles.offlineText}>{t('follow.offlineReady')}</Text>
            </>
          )}
          {offline.status === 'error' && (
            <Pressable
              onPress={offline.retry}
              style={styles.offlineRetry}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.retryOfflineMap')}
            >
              <MaterialCommunityIcons name="cloud-alert" size={16} color={colors.sunsetOrange} />
              <Text style={styles.offlineText}>
                {t('follow.offlineError')} · {t('follow.offlineRetry')}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        onPress={() => WebBrowser.openBrowserAsync(OSM_COPYRIGHT_URL)}
        style={styles.attribution}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel={t('a11y.openStreetMapCopyright')}
      >
        <Text style={styles.attributionText}>{mapAttribution()}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F2EFE9',
  },
  map: {
    flex: 1,
  },
  pin: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pinInactive: {
    backgroundColor: colors.paperWhite,
    borderColor: colors.electricBlue,
  },
  pinActive: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.paperWhite,
  },
  pinLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textAlign: 'center',
  },
  pinLabelInactive: {
    color: colors.deepOcean,
  },
  pinLabelActive: {
    color: colors.paperWhite,
    fontSize: 16,
  },
  userDotHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 26,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2EFE9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  offlinePill: {
    position: 'absolute',
    bottom: 26,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  offlineRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
  },
});
