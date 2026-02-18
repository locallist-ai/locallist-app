# LocalList.App

Parent context: see `../CLAUDE.md` for brand, domain concepts, and conventions.

| | Details |
|---|---|
| **Tech** | Expo SDK 54, React Native, Expo Router 6 |
| **Deploy** | EAS Build → Apple App Store (TestFlight for beta) |
| **Auth** | Apple Sign In + Google OAuth + email/password |
| **Payments** | RevenueCat SDK (Apple IAP) — **planned, not yet installed** |
| **Storage** | SecureStore (iOS/Android), localStorage (web) |
| **iOS Target** | iOS 16.0+ (set in app.json) |
| **Privacy** | Privacy manifest configured (4 API types, 3 data types, no tracking) |

## Running Locally

```bash
cd LocalList/LocalList.App && npx expo start --dev-client
```

## Android Development Build

Usamos **development build** (`expo-dev-client`) en lugar de Expo Go. El dev build compila las dependencias nativas exactas del proyecto, evitando mismatches de versiones.

**Requisitos**:
- **JDK 17**: `C:\Program Files\Java\jdk-17` (configurar `JAVA_HOME`)
- **Android SDK**: `C:\Users\Pablo\AppData\Local\Android\Sdk`
- **AVD disponible**: `pixel_5`

**Env vars** (configuradas permanentemente en User PATH):
- `ANDROID_HOME` = `C:\Users\Pablo\AppData\Local\Android\Sdk`
- `PATH` incluye `platform-tools` y `emulator` (adb y emulator disponibles globalmente)
- `JAVA_HOME` = `C:\Program Files\Java\jdk-17` (necesaria para Gradle)

### Primera vez (compilar + instalar APK)

```bash
# 1. Iniciar el emulador
emulator -avd pixel_5 &disown

# 2. Compilar e instalar el dev build (~5 min primera vez)
cd LocalList/LocalList.App
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
npx expo run:android
```

Esto genera la carpeta `android/`, compila con Gradle, instala el APK en el emulador y arranca Metro.

### Uso diario (APK ya instalado)

```bash
cd LocalList/LocalList.App
npx expo start --dev-client
```
Pulsar `a` para abrir en Android. Hot reload funciona automaticamente para cambios JS/TS.

### Cuando recompilar (`npx expo run:android`)
- Al añadir/actualizar dependencias con codigo nativo (ej: nuevo `expo install expo-camera`)
- Al cambiar `app.json` (splash, plugins, scheme)
- Despues de `npx expo prebuild --clean`

**No** necesitas recompilar para cambios en JS/TS/CSS — hot reload los aplica al instante.

### Troubleshooting
- **`JAVA_HOME` no configurado**: `$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'` antes de compilar
- **`local.properties` faltante**: Crear `android/local.properties` con `sdk.dir=C:\\Users\\Pablo\\AppData\\Local\\Android\\Sdk`
- **Ver logs RN**: `adb logcat -s "ReactNativeJS"` para ver console.log del app
- **`adb` o `emulator` no encontrado**: Abrir una terminal nueva (las env vars se cargan al abrir terminal)

## Key Files

- `app/_layout.tsx` — Root layout (ThemeProvider, SafeAreaProvider, splash animation)
- `app/(tabs)/_layout.tsx` — Tab navigation layout
- `app/(tabs)/index.tsx` — Home screen (chat interface, theme switcher, style/company chips, CTA)
- `lib/theme.ts` — Brand tokens (colors, typography, spacing, borderRadius)
- `lib/api.ts` — API client with auto JWT refresh, SecureStore token storage
- `lib/auth.ts` — AuthContext (user state, logout, isPro flag)
- `lib/i18n/` — i18n infrastructure (i18next + expo-localization, EN/ES translations)

## Screens NOT yet implemented (backend ready, no UI)

- Plans list, Plan detail (day-by-day), Place detail
- Account (profile, delete account, privacy policy link)
- Login (Apple Sign In, Google, email/password)
- Builder (AI plan wizard)
- Follow Mode (step-by-step navigation)
