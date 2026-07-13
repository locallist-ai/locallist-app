// Config plugin: certificate pinning vía App Transport Security (NSPinnedDomains).
//
// Inyecta `NSAppTransportSecurity > NSPinnedDomains` en el Info.plist generado por
// prebuild (la carpeta ios/ está gitignorada: CNG puro, este plugin es la única
// fuente de verdad). iOS rechazará cualquier conexión TLS al dominio de la API
// cuya cadena de certificados no contenga una CA con uno de los pins SPKI de abajo.
// Esto neutraliza proxies MITM (mitmproxy, Charles, Burp) aunque el usuario haya
// instalado y confiado su CA en el dispositivo.
//
// ── Qué se pinea y por qué ────────────────────────────────────────────────────
// Se pinean CAs (`NSPinnedCAIdentities`), NO el leaf:
//   - El leaf (*.up.railway.app, Let's Encrypt) rota automáticamente cada ~90 días
//     → pinear el leaf brickearía la app en semanas.
//   - Las intermedias de Let's Encrypt (hoy YE1) también rotan y LE alterna
//     emisoras sin previo aviso.
//   - Se anclan las raíces de ISRG (operador de Let's Encrypt), estables a años
//     vista, cubriendo las tres formas en que puede validar la cadena:
//       ISRG Root X2  — ancla de la cadena ECDSA que Railway sirve hoy
//       ISRG Root X1  — backup: cadenas RSA de LE y cross-sign de X2 (vigente 2035)
//       ISRG Root YE  — presente en la cadena viva servida hoy; cubre el caso de
//                       que la validación del sistema termine en ella
//   Apple exige ≥2 pins (primario + backup); aquí hay 3, todos del mismo operador.
//
// ── RIESGO (leer antes de tocar) ──────────────────────────────────────────────
// Un pin mal generado, o que Railway cambie de proveedor de certificados (p. ej.
// de Let's Encrypt a Google Trust Services), deja la app SIN CONEXIÓN a la API
// para todos los usuarios hasta publicar una release nueva en el App Store.
// No hay kill-switch remoto para ATS. Verificar los pins DOS veces antes de
// buildear y vigilar cualquier anuncio de cambio de CA de Railway/Let's Encrypt.
//
// ── Rotación: cómo regenerar los pins ─────────────────────────────────────────
// 1. Descargar la cadena viva:
//      echo | openssl s_client -connect <dominio>:443 -servername <dominio> -showcerts
// 2. Por cada certificado CA de la cadena (guardado en un fichero PEM), calcular
//    el SHA-256 en base64 del SubjectPublicKeyInfo (SPKI):
//      openssl x509 -pubkey -noout -in cert.pem \
//        | openssl pkey -pubin -outform der \
//        | openssl dgst -sha256 -binary | openssl enc -base64
// 3. Contrastar con una segunda fuente (los pins de ISRG Root X1/X2 son públicos,
//    p. ej. https://letsencrypt.org/certificates/) y recalcular por una vía
//    independiente antes de commitear.
// 4. Para rotar sin ventana de brick: publicar primero una release con los pins
//    viejos + nuevos conviviendo, y solo retirar los viejos cuando la base
//    instalada haya migrado.
//
// Pins generados el 2026-07-13 contra la cadena viva del dominio y verificados
// con openssl + python (hashlib) y contra los valores públicos de ISRG.

const { withInfoPlist } = require('expo/config-plugins');

const API_DOMAIN = 'locallist-api-net-production.up.railway.app';

// SPKI-SHA256-BASE64 de las CAs ancladas (ver bloque de arriba para regenerar).
const PINNED_CA_SPKI_SHA256 = [
  'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=', // ISRG Root X2 (ancla actual, ECDSA)
  'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=', // ISRG Root X1 (backup, RSA + cross-sign)
  'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=', // ISRG Root YE (en la cadena viva actual)
];

/** @param {import('expo/config').ExpoConfig} config */
function withCertPinning(config) {
  return withInfoPlist(config, (config) => {
    const ats = config.modResults.NSAppTransportSecurity ?? {};
    ats.NSPinnedDomains = {
      ...ats.NSPinnedDomains,
      [API_DOMAIN]: {
        // Host exacto de la API; no hay subdominios propios bajo él.
        NSIncludesSubdomains: false,
        NSPinnedCAIdentities: PINNED_CA_SPKI_SHA256.map((hash) => ({
          'SPKI-SHA256-BASE64': hash,
        })),
      },
    };
    config.modResults.NSAppTransportSecurity = ats;
    return config;
  });
}

module.exports = withCertPinning;
