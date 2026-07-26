import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { getFavorites } from '../lib/api';
import { useFavorites } from '../lib/favorites-store';
import { PhotoHero, type Category } from '../components/ui/PhotoHero';
import { FavoriteButton } from '../components/ui/FavoriteButton';
import type { Place } from '../lib/types';

const PAGE_SIZE = 20;

export default function FavoritesScreen() {
  const { t } = useTranslation();
  // `loaded` gates the id-based filter so a slow id fetch never flashes the list
  // empty; `ids` drives instant optimistic removal (and revert) from this list.
  const { ids, loaded } = useFavorites();

  const [places, setPlaces] = useState<Place[]>([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number): Promise<Place[] | null> => {
    const res = await getFavorites(PAGE_SIZE, offset);
    if (!res.data) {
      setError(res.error ?? t('favorites.loadError'));
      return null;
    }
    setError(null);
    setTotal(res.data.total);
    return res.data.places;
  }, [t]);

  const loadFirstPage = useCallback(async () => {
    const page = await fetchPage(0);
    setPlaces(page ?? []);
    setInitialLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const page = await fetchPage(0);
    if (page) setPlaces(page);
    setRefreshing(false);
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || places.length >= total) return;
    setLoadingMore(true);
    const page = await fetchPage(places.length);
    if (page && page.length > 0) {
      // Dedupe defensively against overlapping offsets after removals.
      setPlaces((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
      });
    }
    setLoadingMore(false);
  }, [loadingMore, places.length, total, fetchPage]);

  // Optimistic removal: a heart-tap drops the id from the store; filtering by the
  // live set makes the row vanish instantly and reappear on API revert.
  const visible = loaded ? places.filter((p) => ids.has(p.id)) : places;

  const renderItem = useCallback(
    ({ item }: { item: Place }) => {
      const photoUrl = item.photos?.[0];
      const subtitle = [item.neighborhood, item.city].filter(Boolean).join(' · ');
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/place/${item.id}`)}
          style={s.card}
        >
          <PhotoHero
            imageUrl={photoUrl}
            photoSource={item.photoSource}
            fallbackCategory={(item.category as Category) ?? 'Culture'}
            title={item.name}
            subtitle={subtitle}
            height={150}
          />
          <FavoriteButton placeId={item.id} source="list" style={s.favoriteBtn} />
        </TouchableOpacity>
      );
    },
    [],
  );

  if (initialLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  if (error && visible.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.exploreBtn} onPress={onRefresh} accessibilityRole="button">
          <Text style={s.exploreBtnText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (visible.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="heart-outline" size={56} color={colors.sunsetOrange} />
        <Text style={s.emptyTitle}>{t('favorites.emptyTitle')}</Text>
        <Text style={s.emptyBody}>{t('favorites.emptyBody')}</Text>
        <TouchableOpacity
          style={s.exploreBtn}
          onPress={() => router.push('/(tabs)/home')}
          accessibilityRole="button"
          accessibilityLabel={t('favorites.exploreCta')}
        >
          <Text style={s.exploreBtnText}>{t('favorites.exploreCta')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sunsetOrange} />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.electricBlue} />
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
    marginBottom: spacing.md,
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  exploreBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.electricBlue,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: borderRadius.lg,
  },
  exploreBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
