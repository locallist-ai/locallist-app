import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Share,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../lib/theme';
import { sharePlan, unsharePlan } from '../../lib/api';
import { track } from '../../lib/analytics';
import { ConfirmModal } from '../ui/ConfirmModal';

/** Canonical shareable link. Universal links (Apple) come later; today this URL
 *  is the artifact the user copies/sends. */
const SHARE_LINK_BASE = 'https://locallist.ai/p';

/**
 * Visibility rule for the owner share affordance: only a persisted, owned plan
 * (never a brand-new/preview draft) is shareable. A reader / non-owner never
 * sees it. Pure so it is testable without mounting the plan screen.
 */
export function shouldShowShareButton(params: {
  isNew: boolean;
  isOwner: boolean;
  planId: string | null;
}): boolean {
  return !params.isNew && params.isOwner && !!params.planId;
}

interface ShareButtonProps {
  /** Real plan id (never 'new'/'preview'; the caller only mounts this for a
   *  persisted, owned plan). */
  planId: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Owner-only "Share plan" affordance (Social S1, UI mínima). Tap ⇒ ensures the
 * plan is shared (`POST /plans/{id}/share`, idempotente) and opens the native
 * Share sheet with the canonical link. Long-press (once shared this session) ⇒
 * ActionSheet to re-share or revoke (`DELETE /plans/{id}/share`) with a confirm.
 * No native modules beyond RN's own `Share`/`ActionSheetIOS`.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({ planId, style }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  // Whether this plan is currently shared (visibility unlisted/public). Known
  // only after a share this session; gates the revoke affordance.
  const [shared, setShared] = useState(false);
  const [revokeVisible, setRevokeVisible] = useState(false);
  // Latch: prevents a same-frame double tap from firing two POSTs.
  const inFlight = useRef(false);

  const openShareSheet = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const res = await sharePlan(planId);
    setBusy(false);
    inFlight.current = false;

    if (!res.data?.shareToken) {
      Alert.alert(t('share.errorTitle'), t('share.errorBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.tryAgain'), onPress: () => { void openShareSheet(); } },
      ]);
      return;
    }

    setShared(true);
    track({ event: 'plan_share_opened' });
    const url = `${SHARE_LINK_BASE}/${res.data.shareToken}`;
    try {
      // User cancelling the sheet resolves with dismissedAction ⇒ silent no-op.
      await Share.share({ message: t('share.message', { url }), url });
    } catch {
      // Sharing itself failing (rare) is non-fatal: the link already exists.
    }
  }, [planId, t]);

  const confirmRevoke = useCallback(async () => {
    setRevokeVisible(false);
    setBusy(true);
    const res = await unsharePlan(planId);
    setBusy(false);
    if (res.status >= 200 && res.status < 300) {
      setShared(false);
      track({ event: 'plan_share_revoked' });
      Alert.alert(t('share.revokedTitle'), t('share.revokedBody'));
    } else {
      Alert.alert(t('share.errorTitle'), t('share.errorBody'));
    }
  }, [planId, t]);

  const handleLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Only offer "stop sharing" once we know the plan is shared; otherwise the
    // long-press just shares (nothing to revoke yet).
    if (!shared) { void openShareSheet(); return; }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('share.actionTitle'),
        options: [t('share.actionShare'), t('share.actionStopSharing'), t('common.cancel')],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) void openShareSheet();
        else if (index === 1) setRevokeVisible(true);
      },
    );
  }, [shared, openShareSheet, t]);

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, style]}
        onPress={() => { void openShareSheet(); }}
        onLongPress={handleLongPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('share.a11yShare')}
        activeOpacity={0.7}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.sunsetOrange} />
        ) : (
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.sunsetOrange} />
        )}
      </TouchableOpacity>

      <ConfirmModal
        visible={revokeVisible}
        icon="link-outline"
        iconColor={colors.sunsetOrange}
        title={t('share.revokeTitle')}
        body={t('share.revokeBody')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('share.revokeConfirm')}
        confirmDestructive
        onCancel={() => setRevokeVisible(false)}
        onConfirm={() => { void confirmRevoke(); }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
  },
});

ShareButton.displayName = 'ShareButton';
