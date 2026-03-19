import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import type { Place } from '../../lib/types';

const CATEGORIES = ['Food', 'Coffee', 'Culture', 'Outdoors', 'Nightlife', 'Wellness'] as const;

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant-outline',
  Coffee: 'cafe-outline',
  Culture: 'color-palette-outline',
  Outdoors: 'leaf-outline',
  Nightlife: 'moon-outline',
  Wellness: 'fitness-outline',
};

type Props = {
  visible: boolean;
  city: string;
  onSelect: (place: Place) => void;
  onClose: () => void;
};

export function PlaceSearchModal({ visible, city, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(
    async (searchQuery: string, searchCategory: string | null) => {
      const params = new URLSearchParams();
      params.set('city', city);
      params.set('limit', '30');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (searchCategory) params.set('category', searchCategory.toLowerCase());

      setLoading(true);
      const res = await api<{ places: Place[]; total: number }>(
        `/places?${params.toString()}`,
      );
      if (res.data) {
        setResults(res.data.places);
      }
      setLoading(false);
      setSearched(true);
    },
    [city],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(text, category);
      }, 400);
    },
    [category, search],
  );

  const handleCategoryPress = useCallback(
    (cat: string) => {
      const newCat = category === cat ? null : cat;
      setCategory(newCat);
      search(query, newCat);
    },
    [category, query, search],
  );

  const handleOpen = useCallback(() => {
    if (!searched) search('', null);
  }, [searched, search]);

  const renderPlace = ({ item }: { item: Place }) => {
    const photoUrl = item.photos?.[0] ?? null;

    return (
      <TouchableOpacity
        style={s.placeRow}
        onPress={() => {
          onSelect(item);
          setQuery('');
          setCategory(null);
          setResults([]);
          setSearched(false);
        }}
        activeOpacity={0.7}
      >
        <View style={s.placeThumbnail}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={s.placeImg} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              style={s.placeImg}
            />
          )}
        </View>
        <View style={s.placeInfo}>
          <Text style={s.placeName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={s.placeMetaRow}>
            {item.category && (
              <View style={s.placeCatChip}>
                <Text style={s.placeCatText}>{item.category}</Text>
              </View>
            )}
            {item.neighborhood && (
              <Text style={s.placeNeighborhood} numberOfLines={1}>
                {item.neighborhood}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="add-circle" size={24} color={colors.sunsetOrange} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={s.searchInput}
            placeholder={`Search places in ${city}...`}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips — 2 rows grid */}
        <View style={s.chipGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.chip, category === cat && s.chipActive]}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat]}
                size={15}
                color={category === cat ? '#FFFFFF' : colors.textSecondary}
              />
              <Text style={[s.chipText, category === cat && s.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.electricBlue} />
          </View>
        ) : results.length === 0 && searched ? (
          <View style={s.center}>
            <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
            <Text style={s.emptyText}>No places found</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderPlace}
            contentContainerStyle={s.resultsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
    padding: 0,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: '31%',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  chipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  resultsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  placeThumbnail: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  placeImg: {
    width: '100%',
    height: '100%',
  },
  placeInfo: {
    flex: 1,
    gap: 4,
  },
  placeName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeCatChip: {
    backgroundColor: colors.sunsetOrange + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  placeCatText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.sunsetOrange,
  },
  placeNeighborhood: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
});
