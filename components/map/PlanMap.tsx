import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';

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
  style?: any;
}

const PIN_COLOR = '#3b82f6'; // electric-blue
const ACTIVE_PIN_COLOR = '#f97316'; // sunset-orange

export const PlanMap: React.FC<PlanMapProps> = ({
  stops,
  activePinIndex = 0,
  onCameraUpdate,
  style,
}) => {
  const mapRef = useRef<MapLibreGL.MapView>(null);
  const cameraRef = useRef<MapLibreGL.Camera>(null);
  const scaleAnim = useSharedValue(1);

  // Pulsing animation for active pin
  useEffect(() => {
    scaleAnim.value = withRepeat(
      withSpring(1.3, { damping: 10, mass: 1 }),
      -1,
      true
    );
  }, [scaleAnim]);

  // Fly to active pin when it changes
  useEffect(() => {
    if (stops.length === 0 || activePinIndex >= stops.length) return;

    const activeStop = stops[activePinIndex];
    if (cameraRef.current) {
      cameraRef.current.flyTo(
        [activeStop.longitude, activeStop.latitude],
        1500 // duration in ms
      );
      onCameraUpdate?.({ latitude: activeStop.latitude, longitude: activeStop.longitude });
    }
  }, [activePinIndex, stops, onCameraUpdate]);

  // Calculate center and bounds for initial view
  const calculateBounds = () => {
    if (stops.length === 0) {
      return {
        center: [0, 0],
        bounds: undefined,
      };
    }

    let minLat = stops[0].latitude;
    let maxLat = stops[0].latitude;
    let minLng = stops[0].longitude;
    let maxLng = stops[0].longitude;

    stops.forEach((stop) => {
      minLat = Math.min(minLat, stop.latitude);
      maxLat = Math.max(maxLat, stop.latitude);
      minLng = Math.min(minLng, stop.longitude);
      maxLng = Math.max(maxLng, stop.longitude);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    return {
      center: [centerLng, centerLat],
      bounds: {
        ne: [maxLng, maxLat],
        sw: [minLng, minLat],
      },
    };
  };

  const { center, bounds } = calculateBounds();

  // Create GeoJSON for route line
  const routeGeoJSON: GeoJSON.GeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: stops.map((stop) => [stop.longitude, stop.latitude]),
        },
        properties: {},
      },
    ],
  };

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json"
        zoomLevel={13}
        centerCoordinate={center as [number, number]}
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

        {/* Route line */}
        {stops.length > 1 && (
          <MapLibreGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#3b82f6',
                lineWidth: 3,
                lineOpacity: 0.6,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Stop pins */}
        {stops.map((stop, index) => (
          <MapLibreGL.PointAnnotation
            key={stop.id}
            id={stop.id}
            coordinate={[stop.longitude, stop.latitude]}
          >
            <View
              style={[
                styles.pinContainer,
                {
                  backgroundColor:
                    index === activePinIndex ? ACTIVE_PIN_COLOR : PIN_COLOR,
                },
              ]}
            >
              <View
                style={[
                  styles.pinDot,
                  {
                    transform: [{ scale: index === activePinIndex ? 1.3 : 1 }],
                  },
                ]}
              />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
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
  pinContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
});
