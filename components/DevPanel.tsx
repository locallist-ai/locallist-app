/**
 * DevPanel — floating toggle to switch between Anonymous / Free / Pro.
 * Only rendered when __DEV__ is true.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useDevPreferences, type MockProfile } from '../lib/dev-preferences';
import { colors, fonts } from '../lib/theme';

const PROFILES: { id: MockProfile; label: string; icon: string; desc: string }[] = [
  {
    id: 'anonymous',
    label: 'Anonymous',
    icon: '\u{1F441}',
    desc: 'Not logged in. Sees signup prompts, limited builder, no Follow Mode.',
  },
  {
    id: 'free',
    label: 'Free',
    icon: '\u{1F464}',
    desc: 'Logged in, free tier. Sees paywall for Follow Mode, limited AI plans.',
  },
  {
    id: 'pro',
    label: 'Pro',
    icon: '\u2B50',
    desc: 'Logged in, Pro subscriber. Full access to everything.',
  },
];

const BADGE_COLORS: Record<MockProfile, string> = {
  anonymous: colors.textSecondary,
  free: colors.electricBlue,
  pro: colors.sunsetOrange,
};

export function DevPanel() {
  const { mockProfile, setMockProfile } = useDevPreferences();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating badge */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: BADGE_COLORS[mockProfile] }]}
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabText}>
          {mockProfile === 'anonymous' ? 'AN' : mockProfile === 'free' ? 'FR' : 'PR'}
        </Text>
      </TouchableOpacity>

      {/* Panel modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Dev Preferences</Text>
              <Text style={styles.panelSubtitle}>Switch user profile to test different flows</Text>
            </View>

            {PROFILES.map((p) => {
              const active = mockProfile === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.option, active && styles.optionActive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setMockProfile(p.id);
                    setOpen(false);
                  }}
                >
                  <View style={styles.optionLeft}>
                    <Text style={styles.optionIcon}>{p.icon}</Text>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {p.label}
                      </Text>
                      <Text style={styles.optionDesc}>{p.desc}</Text>
                    </View>
                  </View>
                  {active && (
                    <View style={[styles.activeDot, { backgroundColor: BADGE_COLORS[p.id] }]} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.closeBtn}
              activeOpacity={0.8}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Floating Badge ─────────────────────
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  fabText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Overlay ────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  // ── Panel ──────────────────────────────
  panel: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  panelHeader: {
    marginBottom: 22,
  },
  panelTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
    marginBottom: 4,
  },
  panelSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ── Options ────────────────────────────
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgMain,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionActive: {
    borderColor: colors.deepOcean,
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMain,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: colors.deepOcean,
  },
  optionDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 12,
  },

  // ── Close ──────────────────────────────
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  closeBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
