import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, fonts, borderRadius, spacing } from '../../lib/theme';
import { api } from '../../lib/api';
import { setPreviewPlan } from '../../lib/plan-store';
import { BuilderResponse } from '../../lib/types';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

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

export default function BuilderWizardScreen() {
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(0);

    // State
    const [style, setStyle] = useState<string | null>(null);
    const [company, setCompany] = useState<string | null>(null);
    const [duration, setDuration] = useState<string | null>(null);
    const [budget, setBudget] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hapticSelect = () => {
        Haptics.selectionAsync();
    };

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (step < 2) {
            setStep(step + 1);
        } else {
            generatePlan();
        }
    };

    const handleBack = () => {
        if (step > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep(step - 1);
        } else {
            router.back();
        }
    };

    const generatePlan = async () => {
        setLoading(true);
        setError(null);
        const body = {
            message: 'Plan a great trip for me',
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
            router.replace('/plan/preview');
        } else {
            setError(res.error ?? 'Something went wrong');
        }
    };

    const renderStepIndicators = () => (
        <View style={s.indicators}>
            {[0, 1, 2].map((i) => (
                <Animated.View
                    key={i}
                    layout={Layout.springify()}
                    style={[
                        s.dot,
                        {
                            backgroundColor: i === step ? colors.sunsetOrange : 'rgba(255,255,255,0.3)',
                            width: i === step ? 24 : 8,
                        }
                    ]}
                />
            ))}
        </View>
    );

    return (
        <View style={s.container}>
            <Image
                source={require('../../assets/images/hero-bg.jpg')}
                style={s.bgImage}
                blurRadius={10}
            />
            <View style={s.overlay} />

            <BlurView intensity={80} tint="dark" style={[s.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>

                {/* Header */}
                <View style={s.header}>
                    <Pressable onPress={handleBack} style={s.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                    </Pressable>
                    {renderStepIndicators()}
                    <View style={{ width: 40 }} />
                </View>

                {/* Steps Content */}
                <View style={s.stepContainer}>
                    {step === 0 && (
                        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={s.stepBody}>
                            <Text style={s.title}>What's your vibe?</Text>
                            <Text style={s.subtitle}>Select the style of trip you are looking for.</Text>

                            <View style={s.optionsGrid}>
                                {STYLE_OPTIONS.map((o) => {
                                    const sel = style === o.id;
                                    return (
                                        <Pressable
                                            key={o.id}
                                            onPress={() => { hapticSelect(); setStyle(sel ? null : o.id); }}
                                            style={[s.optionCard, sel && s.optionSelected]}
                                        >
                                            <View style={[s.iconBox, sel && { backgroundColor: colors.sunsetOrange }]}>
                                                <Ionicons name={o.icon} size={28} color={sel ? '#FFF' : '#A0AEC0'} />
                                            </View>
                                            <Text style={[s.optionText, sel && s.optionTextSelected]}>{o.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    )}

                    {step === 1 && (
                        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={s.stepBody}>
                            <Text style={s.title}>Who's coming?</Text>
                            <Text style={s.subtitle}>Who are you going to share this amazing trip with?</Text>

                            <View style={s.optionsGrid}>
                                {COMPANY_OPTIONS.map((o) => {
                                    const sel = company === o.id;
                                    return (
                                        <Pressable
                                            key={o.id}
                                            onPress={() => { hapticSelect(); setCompany(sel ? null : o.id); }}
                                            style={[s.optionCard, sel && s.optionSelected]}
                                        >
                                            <View style={[s.iconBox, sel && { backgroundColor: colors.electricBlue }]}>
                                                <Ionicons name={o.icon} size={28} color={sel ? '#FFF' : '#A0AEC0'} />
                                            </View>
                                            <Text style={[s.optionText, sel && s.optionTextSelected]}>{o.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    )}

                    {step === 2 && (
                        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={s.stepBody}>
                            <Text style={s.title}>Details</Text>
                            <Text style={s.subtitle}>How long will you stay and what's your budget?</Text>

                            <Text style={s.sectionHeader}>Duration</Text>
                            <View style={s.multiOptionRow}>
                                {DURATION_OPTIONS.map((o) => {
                                    const sel = duration === o.id;
                                    return (
                                        <Pressable key={o.id} onPress={() => { hapticSelect(); setDuration(sel ? null : o.id); }}
                                            style={[s.pill, sel && s.pillSelected]}
                                        >
                                            <Text style={[s.pillText, sel && s.pillTextSelected]}>{o.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={s.sectionHeader}>Budget</Text>
                            <View style={s.multiOptionRow}>
                                {BUDGET_OPTIONS.map((o) => {
                                    const sel = budget === o.id;
                                    return (
                                        <Pressable key={o.id} onPress={() => { hapticSelect(); setBudget(sel ? null : o.id); }}
                                            style={[s.pill, sel && s.pillSelected]}
                                        >
                                            <Text style={[s.pillText, sel && s.pillTextSelected]}>{o.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    )}

                    {/* Loading state overlays */}
                    {loading && (
                        <Animated.View entering={FadeIn} exiting={FadeOut} style={s.loadingOverlay}>
                            <ActivityIndicator size="large" color={colors.sunsetOrange} />
                            <Text style={s.loadingText}>Crafting your perfect plan...</Text>
                        </Animated.View>
                    )}
                </View>

                {/* Footer */}
                <View style={s.footer}>
                    {error && <Text style={s.errorText}>{error}</Text>}
                    <Pressable
                        onPress={handleNext}
                        disabled={loading}
                        style={({ pressed }) => [s.nextButton, { opacity: pressed || loading ? 0.8 : 1 }]}
                    >
                        <LinearGradient
                            colors={step === 2 ? [colors.sunsetOrange, '#ed8936'] : [colors.electricBlue, '#2563eb']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={s.nextGradient}
                        >
                            <Text style={s.nextButtonText}>
                                {step === 2 ? 'Generate Plan' : 'Continue'}
                            </Text>
                            <Ionicons name={step === 2 ? "sparkles" : "arrow-forward"} size={20} color="#FFF" />
                        </LinearGradient>
                    </Pressable>
                </View>

            </BlurView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    bgImage: { position: 'absolute', width, height, opacity: 0.6 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    content: { flex: 1, paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    indicators: { flexDirection: 'row', gap: 6 },
    dot: { height: 8, borderRadius: 4 },

    stepContainer: { flex: 1 },
    stepBody: { flex: 1 },
    title: { fontFamily: fonts.headingBold, fontSize: 32, color: '#FFF', marginBottom: 8 },
    subtitle: { fontFamily: fonts.body, fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32 },

    optionsGrid: { gap: 16 },
    optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    optionSelected: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' },
    iconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    optionText: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: '#CBD5E0' },
    optionTextSelected: { color: '#FFF', fontFamily: fonts.bodyBold },

    sectionHeader: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: '#FFF', marginBottom: 12, marginTop: 10 },
    multiOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    pill: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    pillSelected: { backgroundColor: colors.sunsetOrange, borderColor: colors.sunsetOrange },
    pillText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: '#A0AEC0' },
    pillTextSelected: { color: '#FFF' },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
    loadingText: { fontFamily: fonts.bodySemiBold, color: '#FFF', marginTop: 16, fontSize: 16 },

    footer: { paddingTop: 20 },
    errorText: { color: colors.error, fontFamily: fonts.body, textAlign: 'center', marginBottom: 12 },
    nextButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
    nextGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 8 },
    nextButtonText: { fontFamily: fonts.bodyBold, fontSize: 17, color: '#FFF' },
});
