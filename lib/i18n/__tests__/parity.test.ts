import en from '../en';
import es from '../es';

type TranslationValue = string | Record<string, unknown>;

function collectPaths(obj: Record<string, TranslationValue>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[path] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, collectPaths(value as Record<string, TranslationValue>, path));
    }
  }
  return result;
}

function extractPlaceholders(str: string): string[] {
  const names = Array.from(str.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]);
  return Array.from(new Set(names)).sort();
}

describe('i18n key parity (en <-> es)', () => {
  const enPaths = collectPaths(en as unknown as Record<string, TranslationValue>);
  const esPaths = collectPaths(es as unknown as Record<string, TranslationValue>);

  const enKeys = Object.keys(enPaths).sort();
  const esKeys = Object.keys(esPaths).sort();

  it('es.ts has exactly the same keys as en.ts', () => {
    const missingInEs = enKeys.filter((k) => !esPaths[k] && esPaths[k] !== '');
    const extraInEs = esKeys.filter((k) => !enPaths[k] && enPaths[k] !== '');

    if (missingInEs.length > 0 || extraInEs.length > 0) {
      const lines: string[] = [];
      if (missingInEs.length > 0) lines.push(`Missing in es.ts:\n  ${missingInEs.join('\n  ')}`);
      if (extraInEs.length > 0) lines.push(`Extra in es.ts (not in en.ts):\n  ${extraInEs.join('\n  ')}`);
      throw new Error(lines.join('\n\n'));
    }
  });

  it('interpolation placeholders match for every key', () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enVal = enPaths[key];
      const esVal = esPaths[key];
      if (!esVal) continue;
      const enPlaceholders = extractPlaceholders(enVal);
      const esPlaceholders = extractPlaceholders(esVal);
      if (JSON.stringify(enPlaceholders) !== JSON.stringify(esPlaceholders)) {
        mismatches.push(`${key}: en=[${enPlaceholders}] es=[${esPlaceholders}]`);
      }
    }
    if (mismatches.length > 0) {
      throw new Error(`Placeholder mismatch:\n  ${mismatches.join('\n  ')}`);
    }
  });
});
