import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { CITIES, cityFromLive, type City } from '../../lib/cities';
import { getLiveCities } from '../../lib/api';
import { logger } from '../../lib/logger';
import { setSelectedCity } from '../../lib/trip-context-store';
import { CityCard } from '../../components/home/CityCard';
import { HeroSkiaBg } from '../../components/home/HeroSkiaBg';
import { EditorialTitle } from '../../components/ui/design-system/EditorialTitle';
import { StepSubtitle } from '../../components/ui/design-system/StepSubtitle';

export default function HomeTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight, compact } = useResponsive();

  // El selector ofrece SOLO ciudades cubiertas (`GET /cities/live`). Arrancamos
  // con el catálogo bundled como render instantáneo + fallback offline, y lo
  // reemplazamos con la verdad del backend en cuanto responde.
  const [cities, setCities] = useState<City[]>(CITIES);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const result = await getLiveCities(controller.signal);
      if (controller.signal.aborted) return;
      if (result.data?.cities?.length) {
        setCities(result.data.cities.map(cityFromLive));
      } else if (result.error) {
        // Red caída: mantenemos el catálogo bundled (Miami) para no romper el
        // selector. La cobertura real se reintenta en el próximo montaje.
        logger.warn('home: /cities/live failed, using bundled catalog', result.error);
      }
    })();
    return () => controller.abort();
  }, []);

  const handleCitySelect = async (cityName: string) => {
    await setSelectedCity(cityName);
    router.push('/chat');
  };

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[styles.bgImage, { width: screenWidth + 200, height: screenHeight + 300 }]}
        resizeMode="cover"
      />
      <HeroSkiaBg />
      <View style={styles.bgOverlay} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (compact ? 80 : 140), paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <EditorialTitle
          text={t('home.whereToNext')}
          size={compact ? 'md' : 'lg'}
          color={colors.paperWhite}
          withShadow
        />
        <StepSubtitle
          text={t('home.pickCitySubtitle')}
          color={colors.paperWhite}
          style={styles.subtitle}
        />

        <View style={styles.cards}>
          {cities.map((city, index) => (
            <CityCard
              key={city.name}
              city={city}
              index={index}
              onSelect={handleCitySelect}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  bgImage: {
    position: 'absolute',
    top: -50,
    left: -100,
    opacity: 0.55,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
  },
  cards: {
    gap: 0,
  },
});
