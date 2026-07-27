// Config plugin: elimina el entitlement `aps-environment` (Push Notifications) del
// target iOS generado por prebuild.
//
// ── Por qué existe ────────────────────────────────────────────────────────────
// `expo-notifications` está instalado SOLO para notificaciones LOCALES (el
// recordatorio del trial en lib/trial-reminder/: scheduleNotificationAsync). La
// app NUNCA recibe push REMOTO. Aun así, el prebuild fresco añade el entitlement
// `aps-environment` al target iOS por el mero hecho de que `expo-notifications`
// esté presente (el default de la lib lo mete; su config plugin ni siquiera se
// registra en app.json a propósito, pero el entitlement se cuela igual).
//
// El perfil de aprovisionamiento (AdHoc y AppStore) NO tiene la capability Push
// Notifications, así que al FIRMAR el build de iOS (dev Y producción) falla con:
//   "Provisioning profile doesn't include the aps-environment entitlement /
//    Push Notifications capability".
//
// Este plugin borra `aps-environment` de los entitlements DESPUÉS de que el resto
// de la config lo haya inyectado (por eso se registra el ÚLTIMO en app.json), de
// modo que el binario firmado no lo pida y case con el perfil.
//
// ── Por qué NO rompe las notifs locales ──────────────────────────────────────
// `aps-environment` autoriza SOLO push REMOTO (APNs: registro de device token,
// payloads del servidor). Las notificaciones LOCALES programadas con
// scheduleNotificationAsync() se disparan en el dispositivo y no tocan APNs ni
// requieren este entitlement. Borrarlo no afecta al trial-reminder.
//
// ── Por qué basta con borrar el entitlement ──────────────────────────────────
// La "Push Notifications capability" del target la ARRASTRA el entitlement: el
// prebuild de Expo no escribe SystemCapabilities en el project.pbxproj para push
// (verificado: grep de push/aps/SystemCapabilities en el .pbxproj generado no da
// resultados). La capability existe únicamente porque el .entitlements declara
// `aps-environment`. Al eliminar esa clave, la capability desaparece y no hace
// falta tocar el .pbxproj.
//
// ── RIESGO / rotación ─────────────────────────────────────────────────────────
// Si algún día LocalList añade push REMOTO de verdad, hay que: (1) retirar este
// plugin, (2) regenerar los perfiles de aprovisionamiento CON la capability Push
// Notifications habilitada en el App ID (Apple Developer portal). Mientras la app
// solo use notifs locales, este plugin debe seguir siendo el último de la lista.

const { withEntitlementsPlist } = require('expo/config-plugins');

/** @param {import('expo/config').ExpoConfig} config */
function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withoutPushEntitlement;
