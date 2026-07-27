import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import type { ImportCandidate } from '../../lib/types';

// A single extracted-candidate row for the import results list.
// Matched candidates are selectable (checkbox); non-matched are shown for
// honesty but not selectable ("not on LocalList"). The `checkBubble` keeps the
// paperWhite/sunsetOrange bubble language — same contract as FavoriteButton /
// ChoiceChip icon bubbles — so the affordance reads as on-brand, not a stock
// checkbox.

export interface CandidateRowProps {
  candidate: ImportCandidate;
  index: number;
  /** Whether this (matched) row is currently selected. */
  selected: boolean;
  /** Toggle selection. Only fires for matched rows. */
  onToggle: (placeId: string) => void;
}

export const CandidateRow: React.FC<CandidateRowProps> = ({
  candidate,
  index,
  selected,
  onToggle,
}) => {
  const { t } = useTranslation();
  // Loosely-typed alias for the badge key computed at runtime.
  const td = t as unknown as (key: string) => string;

  const matchedId = candidate.matchedPlaceId ?? null;
  const isMatched = !!matchedId;
  const badgeKey =
    candidate.matchConfidence === 'high'
      ? 'import.matchedBadgeHigh'
      : candidate.matchConfidence === 'medium'
        ? 'import.matchedBadgeMedium'
        : null;

  return (
    <TouchableOpacity
      activeOpacity={isMatched ? 0.8 : 1}
      disabled={!isMatched}
      onPress={() => matchedId && onToggle(matchedId)}
      testID={`candidate-${index}`}
      accessibilityRole={isMatched ? 'checkbox' : 'text'}
      accessibilityState={{ checked: selected, disabled: !isMatched }}
      style={[s.candidateRow, !isMatched && s.candidateRowDisabled]}
    >
      <View style={[s.checkBubble, selected && s.checkBubbleOn, !isMatched && s.checkBubbleOff]}>
        {isMatched ? (
          <MaterialCommunityIcons
            name={selected ? 'check' : 'plus'}
            size={18}
            color={selected ? '#FFFFFF' : colors.sunsetOrange}
          />
        ) : (
          <MaterialCommunityIcons name="map-marker-off-outline" size={18} color={colors.textSecondary} />
        )}
      </View>
      <View style={s.candidateText}>
        <Text style={[s.candidateName, !isMatched && s.candidateNameMuted]} numberOfLines={1}>
          {isMatched ? candidate.matchedPlaceName ?? candidate.name : candidate.name}
        </Text>
        {isMatched && badgeKey ? (
          <View style={s.confidenceBadge}>
            <Text style={s.confidenceBadgeText}>{td(badgeKey)}</Text>
          </View>
        ) : !isMatched ? (
          <Text style={s.notOnLocalList}>{t('import.notOnLocalList')}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  candidateRowDisabled: {
    opacity: 0.6,
  },
  checkBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  checkBubbleOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  checkBubbleOff: {
    borderColor: colors.borderColor,
  },
  candidateText: {
    flex: 1,
    gap: 4,
  },
  candidateName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMain,
  },
  candidateNameMuted: {
    color: colors.textSecondary,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrangeLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  confidenceBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
  },
  notOnLocalList: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
