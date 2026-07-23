import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../../lib/theme';
import { CITIES, cityFromLive, type City } from '../../lib/cities';
import { getLiveCities } from '../../lib/api';
import { logger } from '../../lib/logger';
import { CityCard } from '../home/CityCard';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';

// Onboarding screen 2 — city / intent. Mirrors the home picker: offers ONLY
// covered cities from `GET /cities/live` (bundled catalog as instant render +
// offline fallback). Selecting a covered city hands (name, covered=true) up to
// the orchestrator, which writes the trip context + prefs and advances.

interface OnboardingCityScreenProps {
  onSelectCity: (cityName: string, covered: boolean) => void;
  // Fired when the user taps "my city isn't listed". The orchestrator emits the
  // `covered:false` analytics event (this grid only surfaces covered cities, so
  // this is the sole demand signal for uncovered cities).
  onNotifyUncovered: () => void;
}

export function OnboardingCityScreen({ onSelectCity, onNotifyUncovered }: OnboardingCityScreenProps) {
  const { t } = useTranslation();
  const [cities, setCities] = useState<City[]>(CITIES);
  // Notify-me (QW4) is not built yet — this only reveals a local acknowledgement
  // and logs intent. When the waitlist endpoint lands, wire it here to capture
  // the uncovered city and POST it (see W2 brief: "deja el hook").
  const [notifyRequested, setNotifyRequested] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const result = await getLiveCities(controller.signal);
      if (controller.signal.aborted) return;
      if (result.data?.cities?.length) {
        setCities(result.data.cities.map(cityFromLive));
      } else if (result.error) {
        logger.warn('onboarding: /cities/live failed, using bundled catalog', result.error);
      }
    })();
    return () => controller.abort();
  }, []);

  const handleNotifyMe = () => {
    setNotifyRequested(true);
    logger.info('onboarding: notify-me requested for an uncovered city (QW4 pending)');
    // Surface demand for uncovered cities to analytics (the only `covered:false`
    // producer). Keep the local ack + logger; the orchestrator owns the event.
    onNotifyUncovered();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <EditorialTitle text={t('onboarding.cityTitle')} size="md" color={colors.paperWhite} withShadow />
      <StepSubtitle text={t('onboarding.citySubtitle')} color={colors.paperWhite} style={styles.subtitle} />

      <View style={styles.cards}>
        {cities.map((city, index) => (
          <CityCard
            key={city.name}
            city={city}
            index={index}
            onSelect={(name) => onSelectCity(name, true)}
          />
        ))}
      </View>

      {notifyRequested ? (
        <Text style={styles.notifyThanks}>{t('onboarding.cityNotifyThanks')}</Text>
      ) : (
        <TouchableOpacity
          style={styles.notifyBtn}
          activeOpacity={0.7}
          onPress={handleNotifyMe}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.cityNotListed')}
        >
          <Text style={styles.notifyText}>{t('onboarding.cityNotListed')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  cards: {
    gap: 0,
  },
  notifyBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  notifyText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.paperWhite,
    textDecorationLine: 'underline',
  },
  notifyThanks: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.paperWhite,
    textAlign: 'center',
    paddingVertical: 14,
  },
});
