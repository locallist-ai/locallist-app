import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { PhotoHero } from '../ui/PhotoHero';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Stop {
  id: string;
  name: string;
  category?: string;
  neighborhood?: string;
  photos?: { url: string }[];
  whyThisPlace?: string;
  duration?: number; // in minutes
  priceRange?: string;
}

interface Plan {
  category?: string;
}

interface StopCardProps {
  stop: Stop;
  plan?: Plan;
  index?: number;
  totalStops?: number;
}

const getCategoryColor = (category?: string): string => {
  const colors: Record<string, string> = {
    Food: '#f97316',
    Outdoors: '#10b981',
    Coffee: '#92400e',
    Nightlife: '#1e1b4b',
    Culture: '#0f172a',
    Wellness: '#7c3aed',
  };
  return colors[category || 'Culture'] || '#0f172a';
};

const formatDuration = (minutes?: number): string => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
};

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  plan,
  index = 0,
  totalStops = 1,
}) => {
  const photoUrl = stop.photos?.[0]?.url;
  const categoryColor = getCategoryColor(stop.category);

  return (
    <ScrollView
      style={styles.container}
      scrollEnabled={false}
      nestedScrollEnabled={false}
    >
      {/* Photo */}
      <PhotoHero
        imageUrl={photoUrl}
        fallbackCategory={(stop.category as any) || 'Culture'}
        height={200}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Place name */}
        <Text style={styles.name}>{stop.name}</Text>

        {/* Category & Neighborhood */}
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryText}>{stop.category || 'Other'}</Text>
          </View>
          {stop.neighborhood && (
            <Text style={styles.neighborhood}>• {stop.neighborhood}</Text>
          )}
        </View>

        {/* Why This Place */}
        {stop.whyThisPlace && (
          <>
            <Text style={styles.sectionLabel}>Why this place</Text>
            <Text style={styles.description}>{stop.whyThisPlace}</Text>
          </>
        )}

        {/* Info row: Duration & Price */}
        {(stop.duration || stop.priceRange) && (
          <View style={styles.infoRow}>
            {stop.duration && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color="#0f172a"
                />
                <Text style={styles.infoPillText}>
                  {formatDuration(stop.duration)}
                </Text>
              </View>
            )}

            {stop.priceRange && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={14}
                  color="#0f172a"
                />
                <Text style={styles.infoPillText}>{stop.priceRange}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  neighborhood: {
    fontSize: 14,
    color: '#64748b',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  description: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
});
