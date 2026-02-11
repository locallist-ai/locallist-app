import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { colors, spacing, typography } from '../lib/theme';

interface PlaceCardProps {
  id: string;
  name: string;
  category: string;
  neighborhood?: string | null;
  whyThisPlace: string;
  priceRange?: string | null;
  googleRating?: string | null;
}

const categoryVariant: Record<string, 'blue' | 'orange' | 'green' | 'default'> = {
  food: 'orange',
  nightlife: 'blue',
  coffee: 'default',
  outdoors: 'green',
  wellness: 'green',
  culture: 'blue',
};

export function PlaceCard({
  id,
  name,
  category,
  neighborhood,
  whyThisPlace,
  priceRange,
  googleRating,
}: PlaceCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/place/${id}`)}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Badge text={category} variant={categoryVariant[category] ?? 'default'} />
          {priceRange && <Text style={styles.price}>{priceRange}</Text>}
        </View>
        <Text style={styles.name}>{name}</Text>
        {neighborhood && (
          <Text style={styles.neighborhood}>{neighborhood}</Text>
        )}
        <Text style={styles.why} numberOfLines={2}>
          {whyThisPlace}
        </Text>
        {googleRating && (
          <Text style={styles.rating}>
            {'\u2605'} {googleRating}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    marginBottom: 2,
  },
  neighborhood: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  why: {
    ...typography.bodySmall,
    fontStyle: 'italic',
  },
  price: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  rating: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    color: colors.sunsetOrange,
  },
});
