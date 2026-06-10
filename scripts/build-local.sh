#!/usr/bin/env bash
# eas build --local con artefactos ordenados: deja el build en
# builds/<perfil>-<fecha>-<sha>.<ext> y conserva solo los 2 mas recientes
# por perfil. Sustituye a llamar a eas a pelo, que suelta
# build-<timestamp>.ipa sin contexto en la raiz del repo.
set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE="${1:-production}"

# eas build lee git HEAD, no archivos locales
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree sucio: commitea antes de buildear (eas lee git HEAD)." >&2
    exit 1
fi

# el perfil preview compila para simulador y produce tar.gz
EXT=ipa
if [[ "$PROFILE" == "preview" ]]; then
    EXT=tar.gz
fi

mkdir -p builds
OUT="builds/${PROFILE}-$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD).${EXT}"
eas build --platform ios --profile "$PROFILE" --local --output "$OUT"

ls -t builds/"${PROFILE}"-*."${EXT}" 2>/dev/null | tail -n +3 | while read -r stale; do
    rm -f "$stale"
    echo "Podado build desfasado: $stale"
done

echo "Artefacto: $OUT"
