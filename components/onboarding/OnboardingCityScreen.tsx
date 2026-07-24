import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../lib/theme';
import { CITIES, cityFromLive, type City } from '../../lib/cities';
import { getLiveCities } from '../../lib/api';
import { logger } from '../../lib/logger';
import { CityCard } from '../home/CityCard';
import { CityRequestInline } from '../home/CityRequestInline';
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <EditorialTitle text={t('onboarding.cityTitle')} size="md" color={colors.deepOcean} />
      <StepSubtitle text={t('onboarding.citySubtitle')} color={colors.textSecondary} style={styles.subtitle} />

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

      <CityRequestInline
        source="onboarding"
        variant="light"
        promptLabel={t('onboarding.cityNotListed')}
        ackLabel={t('onboarding.cityNotifyThanks')}
        onReveal={onNotifyUncovered}
      />
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
});
