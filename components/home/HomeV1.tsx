import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  Animated as RNAnimated,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  ZoomIn,
  LinearTransition,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../../lib/theme';
import { api } from '../../lib/api';
import { setPreviewPlan } from '../../lib/plan-store';
import type { BuilderResponse } from '../../lib/types';

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

const DURATION_OPTIONS = [
  { id: '1', icon: 'sunny-outline' as const, label: '1 day' },
  { id: '2-3', icon: 'flower-outline' as const, label: '2-3 days' },
  { id: '4+', icon: 'airplane-outline' as const, label: '4+ days' },
];

const BUDGET_OPTIONS = [
  { id: 'budget', icon: 'wallet-outline' as const, label: 'Budget' },
  { id: 'moderate', icon: 'cash-outline' as const, label: 'Moderate' },
  { id: 'premium', icon: 'trophy-outline' as const, label: 'Premium' },
];

const hapticSelect = () => {
  if (Platform.OS === 'ios') {
    Haptics.selectionAsync();
  }
};

// Glass-like translucent backgrounds
const GLASS_BG = 'rgba(255, 255, 255, 0.82)';
const GLASS_BG_LIGHT = 'rgba(255, 255, 255, 0.68)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.50)';

// ─── Typing dots (RN Animated — lightweight loops) ────

function TypingDots() {
  const dots = useRef([
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(dot, {
            toValue: -6,
            duration: 500,
            delay: i * 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    RNAnimated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <RNAnimated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.sunsetOrange + '60',
            transform: [{ translateY: dot }],
          }}
        />
      ))}
    </View>
  );
}

export function HomeV1() {
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBubbleText, setShowBubbleText] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  useEffect(() => {
    const timer = setTimeout(() => setShowBubbleText(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  const handleCTA = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const body = {
      message: message.trim() || 'Plan a great day',
      tripContext: {
        groupType: company ?? 'solo',
        preferences: style ? [style] : [],
        vibes: style ? [style] : [],
        duration: duration ?? undefined,
        budget: budget ?? undefined,
      },
    };

    const res = await api<BuilderResponse>('/builder/chat', { method: 'POST', body });
    setLoading(false);

    if (res.data) {
      setPreviewPlan(res.data);
      router.push('/plan/preview');
    } else {
      setError(res.error ?? 'Something went wrong');
    }
  }, [loading, message, company, style, duration, budget]);

  return (
    <View style={{ flex: 1 }}>
      {/* ── Full-screen background image (extends behind tab bar) ── */}
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -100, // extend behind tab bar to eliminate grey gap
          width: '100%',
          height: screenHeight + 100,
        }}
        resizeMode="cover"
      />
      {/* Soft overlay for readability */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -100,
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
        }}
      />

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* ── TOP HALF: Title + Chat ──────────────── */}
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
          <View style={{ height: 56 }} />

          {/* ── Title ──────────────────────────────── */}
          <Animated.Text
            entering={FadeInDown.duration(800).delay(300).springify().damping(14)}
            style={{
              fontFamily: fonts.headingBold,
              fontSize: 30,
              lineHeight: 36,
              color: '#FFFFFF',
              marginBottom: 24,
              textAlign: 'center',
              textShadowColor: 'rgba(0, 0, 0, 0.35)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 6,
            }}
          >
            {'Your trip,\nyour way'}
          </Animated.Text>

          {/* ── Chat area (bubble + input unified) ──── */}
          <Animated.View
            entering={FadeInUp.duration(800).delay(550).springify().damping(14)}
            style={{
              backgroundColor: GLASS_BG,
              borderRadius: 20,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: GLASS_BORDER,
              padding: 16,
              marginBottom: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            }}
          >
            {/* AI message */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.sunsetOrange + '18',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={{ width: 18, height: 22 }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                {showBubbleText ? (
                  <Text
                    selectable
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 15,
                      lineHeight: 22,
                      color: colors.deepOcean,
                    }}
                  >
                    Hey! Tell me about your ideal trip and I'll build the perfect plan for you.
                  </Text>
                ) : (
                  <TypingDots />
                )}
              </View>
            </View>

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: colors.deepOcean + '10',
                marginBottom: 12,
              }}
            />

            {/* User input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 10,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.textMain,
                  maxHeight: 80,
                  minHeight: 20,
                  paddingVertical: 0,
                }}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell me what you'd like..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
              />
              <Pressable
                onPress={handleCTA}
                disabled={loading}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.sunsetOrange,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  opacity: loading ? 0.5 : pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>

        {/* ── BOTTOM HALF: Preferences + CTA ──────── */}
        <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 8 }}>
          <Animated.View
            layout={LinearTransition}
            style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}
          >
            {/* Style card */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(800).springify().damping(14)}
              style={{
                flex: 1,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: 'center' as const,
                overflow: 'hidden' as const,
                backgroundColor: GLASS_BG_LIGHT,
                borderWidth: 1,
                borderColor: GLASS_BORDER,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 15,
                  color: colors.deepOcean,
                  marginBottom: 10,
                }}
              >
                Style
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  width: '100%',
                }}
              >
                {STYLE_OPTIONS.map((o) => {
                  const sel = style === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: sel ? colors.sunsetOrange + '30' : 'transparent',
                      }}
                      onPress={() => {
                        hapticSelect();
                        setStyle(sel ? null : o.id);
                      }}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: sel ? fonts.bodySemiBold : fonts.body,
                          fontSize: 10,
                          color: sel ? colors.deepOcean : colors.textSecondary,
                        }}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* Company card */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(1050).springify().damping(14)}
              style={{
                flex: 1,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: 'center' as const,
                overflow: 'hidden' as const,
                backgroundColor: GLASS_BG_LIGHT,
                borderWidth: 1,
                borderColor: GLASS_BORDER,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 15,
                  color: colors.deepOcean,
                  marginBottom: 10,
                }}
              >
                Company
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  width: '100%',
                }}
              >
                {COMPANY_OPTIONS.map((o) => {
                  const sel = company === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: sel ? colors.sunsetOrange + '25' : 'transparent',
                      }}
                      onPress={() => {
                        hapticSelect();
                        setCompany(sel ? null : o.id);
                      }}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: sel ? fonts.bodySemiBold : fonts.body,
                          fontSize: 10,
                          color: sel ? colors.deepOcean : colors.textSecondary,
                        }}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>

          {/* ── Duration + Budget row ────────────── */}
          <Animated.View
            layout={LinearTransition}
            style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}
          >
            {/* Duration card */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(1200).springify().damping(14)}
              style={{
                flex: 1,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: 'center' as const,
                overflow: 'hidden' as const,
                backgroundColor: GLASS_BG_LIGHT,
                borderWidth: 1,
                borderColor: GLASS_BORDER,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 15,
                  color: colors.deepOcean,
                  marginBottom: 10,
                }}
              >
                Duration
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  width: '100%',
                }}
              >
                {DURATION_OPTIONS.map((o) => {
                  const sel = duration === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: sel ? colors.sunsetOrange + '30' : 'transparent',
                      }}
                      onPress={() => {
                        hapticSelect();
                        setDuration(sel ? null : o.id);
                      }}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: sel ? fonts.bodySemiBold : fonts.body,
                          fontSize: 10,
                          color: sel ? colors.deepOcean : colors.textSecondary,
                        }}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* Budget card */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(1350).springify().damping(14)}
              style={{
                flex: 1,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: 'center' as const,
                overflow: 'hidden' as const,
                backgroundColor: GLASS_BG_LIGHT,
                borderWidth: 1,
                borderColor: GLASS_BORDER,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 15,
                  color: colors.deepOcean,
                  marginBottom: 10,
                }}
              >
                Budget
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  width: '100%',
                }}
              >
                {BUDGET_OPTIONS.map((o) => {
                  const sel = budget === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: sel ? colors.sunsetOrange + '30' : 'transparent',
                      }}
                      onPress={() => {
                        hapticSelect();
                        setBudget(sel ? null : o.id);
                      }}
                    >
                      <Ionicons
                        name={o.icon}
                        size={22}
                        color={sel ? colors.sunsetOrange : colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: sel ? fonts.bodySemiBold : fonts.body,
                          fontSize: 10,
                          color: sel ? colors.deepOcean : colors.textSecondary,
                        }}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>

          {/* ── Error ──────────────────────────────── */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(300)}
              layout={LinearTransition}
              style={{
                backgroundColor: colors.error + '18',
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.error + '30',
              }}
            >
              <Text
                selectable
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  color: colors.error,
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            </Animated.View>
          )}

          {/* ── CTA ────────────────────────────────── */}
          <Animated.View
            entering={ZoomIn.duration(600).delay(1550).springify().damping(10)}
          >
            <Pressable
              style={({ pressed }) => ({
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center' as const,
                marginBottom: 8,
                backgroundColor: colors.sunsetOrange,
                opacity: loading ? 0.6 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                boxShadow: '0 4px 16px rgba(249, 115, 22, 0.35)',
              })}
              onPress={handleCTA}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 17,
                    color: '#FFFFFF',
                  }}
                >
                  Start your plan
                </Text>
              )}
            </Pressable>
          </Animated.View>

          <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
        </View>
      </View>
    </View>
  );
}
