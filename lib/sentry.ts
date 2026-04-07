import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const IS_DEV = __DEV__;

// DSN is set via environment variable (EXPO_PUBLIC_SENTRY_DSN).
// In production, EAS Build injects it at build time.
// In dev, it can be set in .env or left empty (Sentry silently no-ops).
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn
  ?? process.env.EXPO_PUBLIC_SENTRY_DSN
  ?? '';

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN || undefined,
    debug: IS_DEV && !!SENTRY_DSN,
    environment: IS_DEV ? 'development' : 'production',
    tracesSampleRate: IS_DEV ? 1.0 : 0.2,
    enabled: !IS_DEV && !!SENTRY_DSN,
  });
}

export { Sentry };
