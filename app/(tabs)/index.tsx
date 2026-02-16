import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { themes, themeOrder, type ThemeId } from '../../lib/themes';

const STYLE_OPTIONS = [
  { id: 'adventure', icon: 'compass-outline' as const, label: 'Adventure' },
  { id: 'relax', icon: 'leaf-outline' as const, label: 'Relax' },
  { id: 'cultural', icon: 'color-palette-outline' as const, label: 'Cultural' },
];

const COMPANY_OPTIONS = [
  { id: 'solo', icon: 'person-outline' as const, label: 'Solo' },
  { id: 'couple', icon: 'heart-outline' as const, label: 'Couple' },
  { id: 'family', icon: 'people-outline' as const, label: 'Family' },
];

const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4,
};

export default function HomeScreen() {
  const { themeId, colors, copy, visualStyle, setThemeId } = useTheme();
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);

  const isClassic = visualStyle.layout === 'classic';

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.bgMain }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          isClassic && s.scrollContentClassic,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Theme Switcher ────────────────────── */}
        <View style={[s.themeSwitcher, { backgroundColor: colors.bgCard + '90' }]}>
          {themeOrder.map((id) => {
            const t = themes[id];
            const active = id === themeId;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  s.themeBtn,
                  active && { backgroundColor: colors.deepOcean + '18' },
                ]}
                onPress={() => setThemeId(id)}
                activeOpacity={0.7}
              >
                <View style={[s.themeDot, { backgroundColor: t.dot }]} />
                <Text
                  style={[
                    s.themeBtnText,
                    { color: active ? colors.deepOcean : colors.textSecondary },
                    active && { fontFamily: fonts.bodySemiBold },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Title ──────────────────────────────── */}
        <Text
          style={[
            isClassic ? s.titleClassic : s.title,
            { color: colors.sunsetOrange },
          ]}
        >
          {copy.title}
        </Text>

        {/* ── Subtitle (modern only) ─────────────── */}
        {!isClassic && (
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {copy.subtitle}
          </Text>
        )}

        {/* ── Chat bubble ────────────────────────── */}
        <View style={isClassic ? s.chatAreaClassic : s.chatSection}>
          <View style={s.botRow}>
            <View style={[s.avatar, { backgroundColor: colors.sunsetOrange + '20' }]}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={s.avatarIcon}
                resizeMode="contain"
              />
            </View>
            <View style={[
              s.bubble,
              !isClassic && softShadow,
              visualStyle.bubbleStyle === 'bordered'
                ? { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: visualStyle.bubbleBorderColor ?? colors.borderColor }
                : { backgroundColor: colors.sunsetOrange + '18' },
            ]}>
              <Text style={[s.bubbleText, { color: colors.deepOcean }]}>
                {copy.greeting}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Preferences ────────────────────────── */}
        {isClassic ? (
          /* Classic: two tinted cards side by side */
          <View style={s.cardsRow}>
            <View style={[s.card, { backgroundColor: colors.sunsetOrange + '18' }]}>
              <Text style={[s.cardTitle, { color: colors.deepOcean }]}>Style</Text>
              <View style={s.cardIcons}>
                {STYLE_OPTIONS.map((o) => {
                  const sel = style === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        s.cardIconCol,
                        sel && { backgroundColor: colors.sunsetOrange + '30' },
                      ]}
                      onPress={() => setStyle(sel ? null : o.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={[
                          s.cardIconLabel,
                          { color: sel ? colors.deepOcean : colors.textSecondary },
                          sel && { fontFamily: fonts.bodySemiBold },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[s.card, { backgroundColor: colors.electricBlue + '15' }]}>
              <Text style={[s.cardTitle, { color: colors.deepOcean }]}>Company</Text>
              <View style={s.cardIcons}>
                {COMPANY_OPTIONS.map((o) => {
                  const sel = company === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        s.cardIconCol,
                        sel && { backgroundColor: colors.electricBlue + '25' },
                      ]}
                      onPress={() => setCompany(sel ? null : o.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.electricBlue : colors.textSecondary}
                      />
                      <Text
                        style={[
                          s.cardIconLabel,
                          { color: sel ? colors.deepOcean : colors.textSecondary },
                          sel && { fontFamily: fonts.bodySemiBold },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          /* Modern: horizontal pill chips */
          <>
            <View style={s.chipSection}>
              <Text style={[s.chipSectionLabel, { color: colors.textSecondary }]}>
                Style
              </Text>
              <View style={s.chipRow}>
                {STYLE_OPTIONS.map((o) => {
                  const sel = style === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        s.chip,
                        { backgroundColor: colors.bgCard, borderColor: colors.borderColor },
                        !sel && softShadow,
                        sel && {
                          backgroundColor: colors.sunsetOrange + '15',
                          borderColor: colors.sunsetOrange,
                        },
                      ]}
                      onPress={() => setStyle(sel ? null : o.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={o.icon}
                        size={16}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={[
                          s.chipLabel,
                          { color: sel ? colors.deepOcean : colors.textSecondary },
                          sel && { fontFamily: fonts.bodySemiBold },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.chipSection}>
              <Text style={[s.chipSectionLabel, { color: colors.textSecondary }]}>
                Company
              </Text>
              <View style={s.chipRow}>
                {COMPANY_OPTIONS.map((o) => {
                  const sel = company === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        s.chip,
                        { backgroundColor: colors.bgCard, borderColor: colors.borderColor },
                        !sel && softShadow,
                        sel && {
                          backgroundColor: colors.electricBlue + '15',
                          borderColor: colors.electricBlue,
                        },
                      ]}
                      onPress={() => setCompany(sel ? null : o.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={o.icon}
                        size={16}
                        color={sel ? colors.electricBlue : colors.textSecondary}
                      />
                      <Text
                        style={[
                          s.chipLabel,
                          { color: sel ? colors.deepOcean : colors.textSecondary },
                          sel && { fontFamily: fonts.bodySemiBold },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── Input ──────────────────────────────── */}
        <View
          style={[
            isClassic ? s.inputWrapClassic : s.inputWrap,
            !isClassic && softShadow,
            { backgroundColor: colors.bgCard, borderColor: colors.borderColor },
          ]}
        >
          <TextInput
            style={[
              isClassic ? s.inputClassic : s.input,
              { color: colors.textMain },
            ]}
            value={message}
            onChangeText={setMessage}
            placeholder={copy.inputPlaceholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          {!isClassic && (
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: colors.electricBlue }]}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── CTA ────────────────────────────────── */}
        <TouchableOpacity
          style={[
            isClassic
              ? [s.ctaClassic, { borderColor: colors.sunsetOrange }]
              : [
                  s.cta,
                  softShadow,
                  visualStyle.ctaVariant === 'filled'
                    ? { backgroundColor: visualStyle.ctaFillColor, borderColor: 'transparent', shadowColor: visualStyle.ctaFillColor }
                    : { borderColor: colors.sunsetOrange, backgroundColor: colors.bgCard },
                ],
          ]}
          activeOpacity={0.8}
        >
          <Text style={[
            s.ctaText,
            isClassic
              ? { color: colors.sunsetOrange }
              : visualStyle.ctaVariant === 'filled'
                ? { color: visualStyle.ctaTextColor ?? '#FFFFFF' }
                : { color: colors.sunsetOrange },
          ]}>
            {copy.ctaText}
          </Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 50,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scrollContentClassic: {
    flexGrow: 1,
  },

  /* Theme switcher */
  themeSwitcher: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 20,
    padding: 3,
    marginBottom: 12,
    gap: 2,
  },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 5,
  },
  themeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  themeBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
  },

  /* ── Classic title (centered, original spacing) */
  titleClassic: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 20,
    textAlign: 'center',
  },

  /* ── Modern title (left-aligned) + subtitle */
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },

  /* ── Classic chat area (flex fills remaining space) */
  chatAreaClassic: {
    flex: 1,
  },

  /* ── Modern chat section (fixed spacing) */
  chatSection: {
    marginBottom: 24,
  },

  /* Chat shared */
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    width: 20,
    height: 24,
  },
  bubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '78%',
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },

  /* ── Classic cards */
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginBottom: 10,
  },
  cardIcons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  cardIconCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cardIconLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
  },

  /* ── Modern chips */
  chipSection: {
    marginBottom: 16,
  },
  chipSectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
  },

  /* ── Classic input (simple bordered) */
  inputWrapClassic: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  inputClassic: {
    fontFamily: fonts.body,
    fontSize: 15,
    maxHeight: 80,
    minHeight: 20,
  },

  /* ── Modern input (with send button) */
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    maxHeight: 80,
    minHeight: 28,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Classic CTA (rounded rect, outline only) */
  ctaClassic: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },

  /* ── Modern CTA (pill, shadow) */
  cta: {
    borderWidth: 2,
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
  },
});
