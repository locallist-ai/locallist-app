import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MapStop } from './PlanMap';
import { logger } from '../../lib/logger';

// Category → icon + color (same as PlanMap)
const CATEGORY_STYLES: Record<string, { icon: string; bg: string }> = {
  food: { icon: 'restaurant', bg: '#ef4444' },
  coffee: { icon: 'cafe', bg: '#92400e' },
  nightlife: { icon: 'wine', bg: '#7c3aed' },
  outdoors: { icon: 'leaf', bg: '#16a34a' },
  wellness: { icon: 'fitness', bg: '#0891b2' },
  culture: { icon: 'color-palette', bg: '#d97706' },
};
const DEFAULT_STYLE = { icon: 'location', bg: '#3b82f6' };

function getCategoryStyle(category?: string) {
  if (!category) return DEFAULT_STYLE;
  return CATEGORY_STYLES[category.toLowerCase()] ?? DEFAULT_STYLE;
}

async function fetchRoute(stops: MapStop[]): Promise<GeoJSON.GeoJSON | null> {
  if (stops.length < 2) return null;
  const coords = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) return null;
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: data.routes[0].geometry, properties: {} }],
    };
  } catch (err) {
    logger.warn('OSRM route fetch failed', err);
    return null;
  }
}

function straightLine(stops: MapStop[]): GeoJSON.GeoJSON {
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

interface Props {
  stops: MapStop[];
}

export const PlanOverviewMap: React.FC<Props> = ({ stops }) => {
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.GeoJSON>(straightLine(stops));

  useEffect(() => {
    if (stops.length < 2) return;
    let cancelled = false;
    fetchRoute(stops).then((route) => {
      if (!cancelled) setRouteGeoJSON(route ?? straightLine(stops));
    });
    return () => { cancelled = true; };
  }, [stops]);

  // Calculate bounds with padding
  const bounds = (() => {
    if (stops.length === 0) return undefined;
    let minLat = stops[0].latitude, maxLat = stops[0].latitude;
    let minLng = stops[0].longitude, maxLng = stops[0].longitude;
    stops.forEach((s) => {
      minLat = Math.min(minLat, s.latitude);
      maxLat = Math.max(maxLat, s.latitude);
      minLng = Math.min(minLng, s.longitude);
      maxLng = Math.max(maxLng, s.longitude);
    });
    return { ne: [maxLng + 0.01, maxLat + 0.01], sw: [minLng - 0.01, minLat - 0.01] };
  })();

  const center = stops.length > 0
    ? [stops.reduce((s, c) => s + c.longitude, 0) / stops.length, stops.reduce((s, c) => s + c.latitude, 0) / stops.length]
    : [0, 0];

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
      >
        <MapLibreGL.Camera
          {...(bounds
            ? { bounds: { ne: bounds.ne as [number, number], sw: bounds.sw as [number, number], paddingLeft: 30, paddingRight: 30, paddingTop: 30, paddingBottom: 30 } }
            : { centerCoordinate: center as [number, number], zoomLevel: 12 }
          )}
          animationDuration={0}
        />

        {/* Route */}
        {stops.length > 1 && (
          <MapLibreGL.ShapeSource id="overviewRoute" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="overviewRouteLine"
              style={{
                lineColor: '#3b82f6',
                lineWidth: 3,
                lineOpacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Pins */}
        {stops.map((stop, index) => {
          const catStyle = getCategoryStyle(stop.category);
          return (
            <MapLibreGL.PointAnnotation
              key={stop.id}
              id={stop.id}
              coordinate={[stop.longitude, stop.latitude]}
            >
              <View style={[styles.pin, { backgroundColor: catStyle.bg }]}>
                <Ionicons name={catStyle.icon as any} size={14} color="#FFFFFF" />
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
});
