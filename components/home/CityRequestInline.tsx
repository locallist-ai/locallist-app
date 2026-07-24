import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { requestCity } from '../../lib/api';
import { track } from '../../lib/analytics';

// Shared "request your city" affordance: a discreet link that reveals an inline
// TextInput + send button. On success (201 created / 200 dedup) it hides the
// input and shows an acknowledgement. Rendered on two surfaces: the onboarding
// city screen (light chrome) and the home city picker (dark hero). Variant only
// swaps colours — behaviour is identical.
//
// Client-side validation MIRRORS the server (max 100 chars, unicode letters +
// horizontal spaces + apostrophe/hyphen/dot, must start with a letter) so an
// obviously-bad name never spends a request or the rate-limit budget. The regex
// is the JS equivalent of the server's `^[\p{L}][\p{L}\p{Zs}'\-.]*$` with `u`.

const CITY_MAX = 100;
const CITY_REGEX = /^[\p{L}][\p{L}\p{Zs}'\-.]*$/u;

type Variant = 'light' | 'dark';
type Source = 'onboarding' | 'home';

interface Palette {
  link: string;
  inputText: string;
  inputBg: string;
  border: string;
  placeholder: string;
  submitBg: string;
  submitText: string;
  ackText: string;
  errorText: string;
}

// Light: onboarding cream chrome (deepOcean text, subtle slate border).
const lightPalette: Palette = {
  link: colors.electricBlue,
  inputText: colors.deepOcean,
  inputBg: 'rgba(255,255,255,0.7)',
  border: 'rgba(15,23,42,0.15)',
  placeholder: colors.textSecondary,
  submitBg: colors.electricBlue,
  submitText: colors.paperWhite,
  ackText: colors.textSecondary,
  errorText: colors.error,
};

// Dark: home hero image (legible paperWhite text over the dark overlay).
const darkPalette: Palette = {
  link: 'rgba(242,239,233,0.85)',
  inputText: colors.paperWhite,
  inputBg: 'rgba(15,23,42,0.35)',
  border: 'rgba(242,239,233,0.3)',
  placeholder: 'rgba(242,239,233,0.6)',
  submitBg: colors.electricBlue,
  submitText: colors.paperWhite,
  ackText: colors.paperWhite,
  errorText: '#fca5a5',
};

interface CityRequestInlineProps {
  source: Source;
  variant: Variant;
  /** Link label. Defaults to the shared `cityRequest.prompt`. */
  promptLabel?: string;
  /** Success acknowledgement. Defaults to the shared `cityRequest.thanks`. */
  ackLabel?: string;
  /**
   * Fired once when the link is tapped and the input is revealed. Onboarding
   * uses it to emit the `onboarding_city_selected {covered:false}` demand
   * signal (the sole producer of that event); home has no reveal event.
   */
  onReveal?: () => void;
}

export function CityRequestInline({
  source,
  variant,
  promptLabel,
  ackLabel,
  onReveal,
}: CityRequestInlineProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const palette = variant === 'dark' ? darkPalette : lightPalette;
  const canSubmit = value.trim().length > 0 && status !== 'submitting';

  const handleReveal = () => {
    setRevealed(true);
    onReveal?.();
    // autoFocus prop inside an animated tree crashes on iOS (CLAUDE.md); focus
    // via ref after the reveal instead.
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async () => {
    const city = value.trim();
    // Client-side mirror of the server validation (empty is already gated by the
    // disabled button, but guard anyway for the onSubmitEditing path).
    if (!city) return;
    if (city.length > CITY_MAX) {
      setError(t('cityRequest.tooLong'));
      return;
    }
    if (!CITY_REGEX.test(city)) {
      setError(t('cityRequest.invalid'));
      return;
    }

    setError(null);
    setStatus('submitting');
    Keyboard.dismiss();
    const res = await requestCity(city);

    // 201 created OR 200 idempotent dedup — both are success.
    if (res.status === 200 || res.status === 201) {
      // SIN PII: no mandamos el texto de la ciudad, ya vive en BBDD.
      track({ event: 'city_request_submitted', source });
      setStatus('done');
      return;
    }

    setStatus('idle');
    if (res.status === 429) {
      setError(t('cityRequest.rateLimited'));
      return;
    }
    if (res.status === 400) {
      const code = (res.errorBody as { error?: string } | null)?.error;
      setError(code === 'city_too_long' ? t('cityRequest.tooLong') : t('cityRequest.invalid'));
      return;
    }
    // Network / unexpected — generic retriable message.
    setError(t('cityRequest.error'));
  };

  if (status === 'done') {
    return (
      <Text style={[styles.thanks, { color: palette.ackText }]}>
        {ackLabel ?? t('cityRequest.thanks')}
      </Text>
    );
  }

  if (!revealed) {
    const label = promptLabel ?? t('cityRequest.prompt');
    return (
      <TouchableOpacity
        style={styles.promptBtn}
        activeOpacity={0.7}
        onPress={handleReveal}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.promptText, { color: palette.link }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: palette.inputText, borderColor: palette.border, backgroundColor: palette.inputBg },
          ]}
          value={value}
          onChangeText={(txt) => {
            setValue(txt);
            if (error) setError(null);
          }}
          placeholder={t('cityRequest.placeholder')}
          placeholderTextColor={palette.placeholder}
          maxLength={CITY_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="send"
          editable={status !== 'submitting'}
          onSubmitEditing={() => {
            if (canSubmit) void handleSubmit();
          }}
          accessibilityLabel={t('cityRequest.placeholder')}
        />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: palette.submitBg }, !canSubmit && styles.submitDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel={t('cityRequest.submit')}
        >
          {status === 'submitting' ? (
            <ActivityIndicator size="small" color={palette.submitText} />
          ) : (
            <Text style={[styles.submitText, { color: palette.submitText }]}>{t('cityRequest.submit')}</Text>
          )}
        </TouchableOpacity>
      </View>
      {error ? <Text style={[styles.error, { color: palette.errorText }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promptBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  promptText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  thanks: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 14,
  },
  form: {
    paddingVertical: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  submitBtn: {
    height: 46,
    minWidth: 76,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
