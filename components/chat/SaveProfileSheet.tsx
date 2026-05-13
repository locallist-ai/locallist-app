import React, { useState } from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import type { ChatSlots } from '../../lib/types';

type Props = {
  visible: boolean;
  slots: ChatSlots;
  onSave: (fields: { groupType?: string; pace?: string; budget?: string; dietary?: string[] }) => Promise<void>;
  onSkip: () => void;
};

type Toggle = {
  key: 'groupType' | 'pace' | 'budget' | 'dietary';
  labelKey: string;
  value: string;
  enabled: boolean;
};

function buildToggles(slots: ChatSlots): Toggle[] {
  const out: Toggle[] = [];
  if (slots.groupType) out.push({ key: 'groupType', labelKey: 'profile.groupType', value: slots.groupType, enabled: true });
  if (slots.pace) out.push({ key: 'pace', labelKey: 'profile.pace', value: slots.pace, enabled: true });
  if (slots.budget) out.push({ key: 'budget', labelKey: 'profile.budget', value: slots.budget, enabled: true });
  if (slots.dietary && slots.dietary.length > 0)
    out.push({ key: 'dietary', labelKey: 'profile.dietary', value: slots.dietary.join(', '), enabled: true });
  return out;
}

export function SaveProfileSheet({ visible, slots, onSave, onSkip }: Props) {
  const { t } = useTranslation();
  const [toggles, setToggles] = useState<Toggle[]>(() => buildToggles(slots));
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: string) => {
    setToggles((prev) => prev.map((t) => t.key === key ? { ...t, enabled: !t.enabled } : t));
  };

  const handleSave = async () => {
    const enabled = toggles.filter((t) => t.enabled);
    if (enabled.length === 0) { onSkip(); return; }
    setSaving(true);
    const fields: Parameters<typeof onSave>[0] = {};
    enabled.forEach((t) => {
      if (t.key === 'dietary') fields.dietary = slots.dietary ?? undefined;
      else if (t.key === 'groupType') fields.groupType = slots.groupType ?? undefined;
      else if (t.key === 'pace') fields.pace = slots.pace ?? undefined;
      else if (t.key === 'budget') fields.budget = slots.budget ?? undefined;
    });
    await onSave(fields);
    setSaving(false);
  };

  if (toggles.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onSkip}>
      <Pressable style={styles.backdrop} onPress={onSkip}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} />
      </Pressable>
      <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('profile.saveSheetTitle')}</Text>
        <Text style={styles.subtitle}>{t('profile.saveSheetSub')}</Text>

        {toggles.map((toggle) => (
          <TouchableOpacity
            key={toggle.key}
            style={styles.toggleRow}
            onPress={() => handleToggle(toggle.key)}
            activeOpacity={0.7}
          >
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t(toggle.labelKey as never)}</Text>
              <Text style={styles.toggleValue}>{toggle.value}</Text>
            </View>
            <View style={[styles.toggle, toggle.enabled && styles.toggleOn]}>
              <View style={[styles.toggleThumb, toggle.enabled && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('profile.save')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderColor,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.borderColor,
    justifyContent: 'center',
    padding: 3,
  },
  toggleOn: { backgroundColor: colors.electricBlue },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.electricBlue,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  skipBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
