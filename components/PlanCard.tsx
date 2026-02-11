import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

interface PlanCardProps {
  id: string;
  name: string;
  description?: string | null;
  durationDays: number;
  imageUrl?: string | null;
  type: string;
  isShowcase?: boolean;
}

export function PlanCard({
  id,
  name,
  description,
  durationDays,
  imageUrl,
  type,
  isShowcase,
}: PlanCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/plan/${id}`)}
    >
      <Card padded={false} style={styles.card}>
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        )}
        {!imageUrl && (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>
              {type === 'curated' ? '\u2728' : '\u{1F5FA}'}
            </Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.badges}>
            <Badge
              text={`${durationDays} ${durationDays === 1 ? 'day' : 'days'}`}
              variant="blue"
            />
            {isShowcase && <Badge text="Featured" variant="orange" />}
          </View>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.electricBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  content: {
    padding: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
  },
});
