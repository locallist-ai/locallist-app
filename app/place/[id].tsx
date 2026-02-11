import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useApi } from '../../hooks/useApi';
import { colors, spacing, typography } from '../../lib/theme';

interface PlaceDetail {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  neighborhood: string | null;
  city: string;
  latitude: string | null;
  longitude: string | null;
  whyThisPlace: string;
  bestFor: string[] | null;
  bestTime: string | null;
  priceRange: string | null;
  googleRating: string | null;
  googleReviewCount: number | null;
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useApi<PlaceDetail>(`/places/${id}`);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Place not found</Text>
      </View>
    );
  }

  const openInMaps = () => {
    if (!data.latitude || !data.longitude) return;
    const label = encodeURIComponent(data.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${data.latitude},${data.longitude}`,
      android: `geo:${data.latitude},${data.longitude}?q=${label}`,
      default: `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.name}>{data.name}</Text>
      <View style={styles.badges}>
        <Badge text={data.category} variant="blue" />
        {data.subcategory && <Badge text={data.subcategory} variant="default" />}
        {data.priceRange && <Badge text={data.priceRange} variant="default" />}
      </View>

      {data.neighborhood && (
        <Text style={styles.location}>
          {data.neighborhood}, {data.city}
        </Text>
      )}

      {/* Why This Place */}
      <Card style={styles.whyCard}>
        <Text style={styles.whyTitle}>Why This Place</Text>
        <Text style={styles.whyText}>{data.whyThisPlace}</Text>
      </Card>

      {/* Details */}
      <Card style={styles.detailsCard}>
        {data.googleRating && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rating</Text>
            <Text style={styles.detailValue}>
              {'\u2605'} {data.googleRating}
              {data.googleReviewCount
                ? ` (${data.googleReviewCount.toLocaleString()} reviews)`
                : ''}
            </Text>
          </View>
        )}
        {data.bestTime && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Best Time</Text>
            <Text style={styles.detailValue}>{data.bestTime}</Text>
          </View>
        )}
        {data.bestFor && data.bestFor.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Best For</Text>
            <View style={styles.tagRow}>
              {data.bestFor.map((tag) => (
                <Badge key={tag} text={tag} variant="default" />
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Open in Maps */}
      {data.latitude && data.longitude && (
        <Button
          title="Open in Maps"
          onPress={openInMaps}
          variant="primary"
          size="lg"
          style={styles.mapsButton}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  location: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
  },
  whyCard: {
    marginBottom: spacing.md,
    backgroundColor: '#f0f9ff',
  },
  whyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  whyText: {
    ...typography.body,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  detailsCard: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    ...typography.body,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  mapsButton: {
    width: '100%',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
