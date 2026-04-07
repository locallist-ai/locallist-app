import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import MapLibreGL, { type MapViewRef, type CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../../lib/logger';

export interface MapStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
}

interface PlanMapProps {
  stops: MapStop[];
  activePinIndex?: number;
  onCameraUpdate?: (center: { latitude: number; longitude: number }) => void;
  style?: ViewStyle;
}

// Category → icon + color
const CATEGORY_STYLES: Record<string, { icon: string; bg: string }> = {
  food: { icon: 'restaurant', bg: '#ef4444' },
  coffee: { icon: 'cafe', bg: '#92400e' },
  nightlife: { icon: 'wine', bg: '#7c3aed' },
  outdoors: { icon: 'leaf', bg: '#16a34a' },
  wellness: { icon: 'fitness', bg: '#0891b2' },
  culture: { icon: 'color-palette', bg: '#d97706' },
};
const DEFAULT_STYLE = { icon: 'location', bg: '#3b82f6' };
const ACTIVE_RING = '#f97316';

function getCategoryStyle(category?: string) {
  if (!category) return DEFAULT_STYLE;
  return CATEGORY_STYLES[category.toLowerCase()] ?? DEFAULT_STYLE;
}

/** Fetch real driving route from OSRM (free, no API key) */
async function fetchRoute(stops: MapStop[]): Promise<GeoJSON.GeoJSON | null> {
  if (stops.length < 2) return null;

  const coords = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) return null;

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: data.routes[0].geometry,
          properties: {},
        },
      ],
    };
  } catch (err) {
    logger.warn('OSRM route fetch failed, falling back to straight line', err);
    return null;
  }
}

/** Straight-line fallback */
function straightLineGeoJSON(stops: MapStop[]): GeoJSON.GeoJSON {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: stops.map((s) => [s.longitude, s.latitude]),
        },
        properties: {},
      },
    ],
  };
}

export const PlanMap: React.FC<PlanMapProps> = ({
  stops,
  activePinIndex = 0,
  onCameraUpdate,
  style,
}) => {
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.GeoJSON>(straightLineGeoJSON(stops));

  // Fetch real route from OSRM
  useEffect(() => {
    if (stops.length < 2) return;

    let cancelled = false;
    fetchRoute(stops).then((route) => {
      if (!cancelled) {
        setRouteGeoJSON(route ?? straightLineGeoJSON(stops));
      }
    });
    return () => { cancelled = true; };
  }, [stops]);

  // Fly to active pin when it changes
  useEffect(() => {
    if (stops.length === 0 || activePinIndex >= stops.length) return;

    const activeStop = stops[activePinIndex];
    if (cameraRef.current) {
      cameraRef.current.flyTo(
        [activeStop.longitude, activeStop.latitude],
        1500,
      );
      onCameraUpdate?.({ latitude: activeStop.latitude, longitude: activeStop.longitude });
    }
  }, [activePinIndex, stops, onCameraUpdate]);

  // Center on the active stop (not the geometric center of all stops)
  const activeStop = stops.length > 0 ? stops[Math.min(activePinIndex, stops.length - 1)] : null;
  const center = activeStop ? [activeStop.longitude, activeStop.latitude] : [0, 0];

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          centerCoordinate={center as [number, number]}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={1500}
        />

        {/* Route line (real route from OSRM or straight-line fallback) */}
        {stops.length > 1 && (
          <MapLibreGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#3b82f6',
                lineWidth: 4,
                lineOpacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Stop pins with category icons */}
        {stops.map((stop, index) => {
          const isActive = index === activePinIndex;
          const catStyle = getCategoryStyle(stop.category);

          return (
            <MapLibreGL.PointAnnotation
              key={stop.id}
              id={stop.id}
              coordinate={[stop.longitude, stop.latitude]}
            >
              <View style={[styles.pinOuter, isActive && { borderColor: ACTIVE_RING, borderWidth: 3 }]}>
                <View style={[styles.pinIcon, { backgroundColor: catStyle.bg }]}>
                  <Ionicons name={catStyle.icon as any} size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.pinNumber}>{index + 1}</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>
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
  pinOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    padding: 2,
  },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
});
