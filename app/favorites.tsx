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

/**
 * Pagination model — the offset FOLLOWS THE BACKEND, never the raw local array:
 *
 * A local removal (heart tap) optimistically DELETEs server-side, so the
 * backend list shrinks by exactly the rows filtered out locally. `visible`
 * (loaded rows still in the id set) is therefore congruent with the backend's
 * prefix, and `visible.length` is the correct offset for the next page. Using
 * `places.length` (the raw array, removed rows included) would over-shoot the
 * shrunken backend list and permanently skip rows (adversarial review MAJOR 1).
 *
 * On every appended fetch, locally-removed rows are PURGED from `places`: the
 * fresh response's `total` already excludes them server-side, so keeping them
 * would double-count removals in `effectiveTotal`. Between fetches,
 * `effectiveTotal` (last backend total minus removals since that fetch) keeps
 * the empty state and `hasMore` honest: empty shows ONLY when the user truly
 * has no favorites left, and clearing out a whole loaded page auto-loads the
 * next one instead of dead-ending on a false "no favorites" (MAJOR 2).
 */
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

  // Optimistic removal: a heart-tap drops the id from the store; filtering by the
  // live set makes the row vanish instantly and reappear on API revert.
  const visible = loaded ? places.filter((p) => ids.has(p.id)) : places;
  // Rows removed locally AFTER the last fetch (each fetch purge resets this to 0).
  const removedSinceFetch = places.length - visible.length;
  const effectiveTotal = Math.max(0, total - removedSinceFetch);
  const hasMore = visible.length < effectiveTotal;

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
    // Mount-only on purpose: `fetchPage` depends on `t`, whose identity is not
    // guaranteed stable across renders — the initial load must never refire and
    // clobber the paginated list with page 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const page = await fetchPage(0);
    if (page) setPlaces(page);
    setRefreshing(false);
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Offset = visible rows: congruent with the backend prefix (see header note).
    const page = await fetchPage(visible.length);
    if (page) {
      setPlaces((prev) => {
        // Purge locally-removed rows: the response's `total` already excludes
        // them, so leaving them in the raw array would double-count removals.
        const kept = loaded ? prev.filter((p) => ids.has(p.id)) : prev;
        // Dedupe defensively against overlapping offsets.
        const seen = new Set(kept.map((p) => p.id));
        return [...kept, ...page.filter((p) => !seen.has(p.id))];
      });
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, visible.length, fetchPage, ids, loaded]);

  // MAJOR 2 guard: if the user cleared every loaded row but the backend still
  // has more favorites, fetch the next page instead of painting a false empty
  // state (which would unmount the FlatList and dead-end the screen).
  useEffect(() => {
    if (initialLoading || refreshing || loadingMore || error) return;
    if (visible.length === 0 && hasMore) onEndReached();
  }, [initialLoading, refreshing, loadingMore, error, visible.length, hasMore, onEndReached]);

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

  // Empty ONLY when the user truly has nothing left (backend total minus local
  // removals) — never just because the loaded page was cleared out (MAJOR 2).
  if (effectiveTotal === 0) {
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

  if (visible.length === 0) {
    // More favorites exist server-side; the auto-load effect is fetching them.
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
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
