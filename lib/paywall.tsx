import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, fonts, spacing, borderRadius } from './theme';
import { useAuth } from './auth';

// ─── Feature descriptions for paywall ────────────────────

const PRO_FEATURES = [
    { icon: 'flash-outline' as const, text: '50 AI plans per day' },
    { icon: 'navigate-outline' as const, text: 'Follow Mode (step-by-step)' },
    { icon: 'heart-outline' as const, text: 'Unlimited favorites' },
    { icon: 'color-palette-outline' as const, text: 'Plan customization' },
    { icon: 'map-outline' as const, text: 'Full plan catalog' },
];

// ─── Paywall Modal ───────────────────────────────────────

interface PaywallModalProps {
    visible: boolean;
    onClose: () => void;
    /** Context-specific title, e.g. "Follow Mode is a Pro feature" */
    title?: string;
    /** Context-specific subtitle */
    subtitle?: string;
}

export function PaywallModal({
    visible,
    onClose,
    title = 'Upgrade to Pro',
    subtitle = 'Unlock the full LocalList experience',
}: PaywallModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={s.overlay} onPress={onClose}>
                <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
                    {/* Close button */}
                    <Pressable style={s.closeBtn} onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </Pressable>

                    {/* Badge */}
                    <View style={s.badge}>
                        <Ionicons name="diamond" size={20} color="#FFFFFF" />
                        <Text style={s.badgeText}>PRO</Text>
                    </View>

                    <Text style={s.title}>{title}</Text>
                    <Text style={s.subtitle}>{subtitle}</Text>

                    {/* Feature list */}
                    <View style={s.features}>
                        {PRO_FEATURES.map((f) => (
                            <View key={f.text} style={s.featureRow}>
                                <Ionicons name={f.icon} size={18} color={colors.sunsetOrange} />
                                <Text style={s.featureText}>{f.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Price */}
                    <Text style={s.price}>
                        $6.99<Text style={s.priceUnit}>/month</Text>
                    </Text>
                    <Text style={s.priceAlt}>or $59.99/year (save 28%)</Text>

                    {/* CTA */}
                    <Pressable
                        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
                        onPress={() => {
                            // TODO: Connect to RevenueCat purchase flow
                            onClose();
                        }}
                    >
                        <Text style={s.ctaText}>Start Free Trial</Text>
                    </Pressable>

                    <Text style={s.disclaimer}>
                        Cancel anytime. No commitment.
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─── useProGate Hook ─────────────────────────────────────
// Returns a gate function that either runs the callback (if Pro)
// or shows the paywall modal (if free).

interface ProGateOptions {
    title?: string;
    subtitle?: string;
}

export function useProGate() {
    const { isPro } = useAuth();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalProps, setModalProps] = useState<ProGateOptions>({});

    const gate = useCallback(
        (callback: () => void, options?: ProGateOptions) => {
            if (isPro) {
                callback();
            } else {
                setModalProps(options ?? {});
                setModalVisible(true);
            }
        },
        [isPro],
    );

    const modal = (
        <PaywallModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            title={modalProps.title}
            subtitle={modalProps.subtitle}
        />
    );

    return { gate, modal, isPro };
}

// ─── Styles ──────────────────────────────────────────────

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.xl,
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
            },
            android: { elevation: 12 },
        }),
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 10,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.sunsetOrange,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    badgeText: {
        fontFamily: fonts.bodySemiBold,
        fontSize: 13,
        color: '#FFFFFF',
        letterSpacing: 1.5,
    },
    title: {
        fontFamily: fonts.headingBold,
        fontSize: 22,
        color: colors.deepOcean,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    features: {
        width: '100%',
        gap: 10,
        marginBottom: spacing.lg,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureText: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: colors.textMain,
    },
    price: {
        fontFamily: fonts.headingBold,
        fontSize: 28,
        color: colors.deepOcean,
        marginBottom: 2,
    },
    priceUnit: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
    },
    priceAlt: {
        fontFamily: fonts.body,
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    cta: {
        width: '100%',
        backgroundColor: colors.sunsetOrange,
        paddingVertical: 16,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    ctaText: {
        fontFamily: fonts.bodySemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    disclaimer: {
        fontFamily: fonts.body,
        fontSize: 11,
        color: colors.textSecondary,
    },
});
