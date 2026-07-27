/**
 * Import a plan from your OWN travel video or photo (F2 T5, Plus).
 *
 * Thin orchestrator: owns the attribution inputs (`platform`/`creatorHandle`),
 * consumes the upload hook (`useImportUpload`) for the phase machine + upload,
 * and wires each phase to its screen (idle / progress / results). Gates, the
 * multipart upload with abort-on-unmount, client validation and analytics live
 * in the hook + the phase components. The file name/route stays `import-video`
 * (deep links); only the copy changed. v1 is SELF content by default; the
 * third-party attribution UI is folded behind an opt-in link in `ImportIdle`.
 */
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { useImportUpload } from '../../lib/import/useImportUpload';
import { ImportIdle } from '../../components/import/ImportIdle';
import { ImportProgress } from '../../components/import/ImportProgress';
import { ImportResults } from '../../components/import/ImportResults';
import type { ImportPlatform } from '../../lib/analytics';

export default function ImportVideoScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isPro } = useAuth();
  const { presentGate } = useGateHandler();

  // Attribution: where the (self-uploaded) clip came from. `self` = own content.
  const [platform, setPlatform] = useState<ImportPlatform>('self');
  const [creatorHandle, setCreatorHandle] = useState('');

  const { phase, progress, candidates, city, errorKey, retryable, chooseVideo, retry } =
    useImportUpload({ platform, creatorHandle, presentGate });

  const showClose = phase === 'idle' || phase === 'results';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {showClose ? (
        <TouchableOpacity
          testID="import-close"
          style={s.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>
      ) : null}

      {phase === 'uploading' || phase === 'analyzing' ? (
        <ImportProgress phase={phase} progress={progress} />
      ) : phase === 'results' ? (
        <ImportResults
          candidates={candidates}
          city={city}
          isPro={isPro}
          platform={platform}
          creatorHandle={creatorHandle}
          presentGate={presentGate}
          paddingBottom={insets.bottom}
        />
      ) : (
        <ImportIdle
          platform={platform}
          onPlatformChange={setPlatform}
          creatorHandle={creatorHandle}
          onHandleChange={setCreatorHandle}
          errorKey={errorKey}
          retryable={retryable}
          onChoose={chooseVideo}
          onRetry={retry}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.md,
    zIndex: 10,
  },
});
