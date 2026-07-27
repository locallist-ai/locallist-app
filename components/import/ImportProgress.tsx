import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../../lib/theme';
import { EditorialTitle } from '../ui/design-system';
import { TypingDots } from '../home/TypingDots';

// Import progress — the "uploading"/"analyzing" phase with warmth (no bare
// ActivityIndicator): editorial title that changes by phase + warm animated
// TypingDots + a branded progress bar + two honest steps (Upload -> Analyze).

export interface ImportProgressProps {
  phase: 'uploading' | 'analyzing';
  /** 0..1 upload fraction. Ignored in the analyzing phase (bar reads full). */
  progress: number;
  paddingTop?: number;
}

export const ImportProgress: React.FC<ImportProgressProps> = ({ phase, progress, paddingTop = 0 }) => {
  const { t } = useTranslation();
  const percent = Math.round(progress * 100);
  const isUploading = phase === 'uploading';

  return (
    <View style={[s.container, { paddingTop }]}>
      <View style={s.center}>
        <EditorialTitle
          size="sm"
          text={isUploading ? t('import.phaseUploadingTitle') : t('import.phaseAnalyzingTitle')}
        />
        <TypingDots />

        {/* Two honest steps: what is happening now, what comes next. */}
        <View style={s.steps} testID="import-steps">
          <ImportStep
            label={t('import.stepUpload')}
            active={isUploading}
            done={!isUploading}
          />
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
          <ImportStep label={t('import.stepAnalyze')} active={!isUploading} done={false} />
        </View>

        {/* Branded progress bar. */}
        <View style={s.progressTrack}>
          <View
            testID="import-progress-fill"
            style={[s.progressFill, { width: `${isUploading ? percent : 100}%` }]}
          />
        </View>
        <Text style={s.progressLabel}>
          {isUploading ? t('import.uploadingPercent', { percent }) : t('import.analyzing')}
        </Text>
      </View>
    </View>
  );
};

const ImportStep: React.FC<{ label: string; active: boolean; done: boolean }> = ({
  label,
  active,
  done,
}) => (
  <View style={s.step}>
    {done ? (
      <MaterialCommunityIcons name="check-circle" size={16} color={colors.sunsetOrange} />
    ) : (
      <View style={[s.stepDot, active && s.stepDotActive]} />
    )}
    <Text style={[s.stepLabel, (active || done) && s.stepLabelActive]}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderColor,
  },
  stepDotActive: {
    backgroundColor: colors.sunsetOrange,
  },
  stepLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  stepLabelActive: {
    color: colors.textMain,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderColor,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sunsetOrange,
  },
  progressLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
