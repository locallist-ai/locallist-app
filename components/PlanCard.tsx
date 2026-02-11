import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts } from '../lib/theme';

interface PlanCardProps {
  id: string;
  name: string;
  description?: string | null;
  durationDays: number;
  imageUrl?: string | null;
  type: string;
  isShowcase?: boolean;
}

const TYPE_ACCENTS: Record<string, { gradient: [string, string, string]; icon: string }> = {
  curated: { gradient: ['#0f172a', '#1e3a5f', '#3b82f6'], icon: '\u2728' },
  ai: { gradient: ['#1a1a2e', '#16213e', '#0f3460'], icon: '\u{1F9E0}' },
};

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
  const accent = TYPE_ACCENTS[type] ?? TYPE_ACCENTS.curated;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => router.push(`/plan/${id}`)}
      style={styles.outer}
    >
      <View style={styles.card}>
        {/* Accent bar */}
        <View style={styles.accentBar} />

        {/* Gradient visual */}
        <LinearGradient
          colors={accent.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.visual}
        >
          <Text style={styles.visualIcon}>{accent.icon}</Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <View style={styles.daysBadge}>
              <Text style={styles.daysText}>
                {durationDays} {durationDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
            {isShowcase && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredText}>Curated</Text>
              </View>
            )}
            {type === 'ai' && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiText}>AI-Built</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.sunsetOrange,
    zIndex: 10,
  },
  visual: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualIcon: {
    fontSize: 36,
    opacity: 0.6,
  },
  content: {
    padding: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  daysBadge: {
    backgroundColor: colors.electricBlueLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  daysText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.electricBlue,
    letterSpacing: 0.3,
  },
  featuredBadge: {
    backgroundColor: colors.sunsetOrange + 'DD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  aiBadge: {
    backgroundColor: colors.deepOcean + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.deepOcean,
    letterSpacing: 0.3,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.deepOcean,
    lineHeight: 26,
    marginBottom: 4,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
