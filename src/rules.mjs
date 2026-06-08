// license-yoshi: ライセンス分類ルール
// code-provenance.md 準拠（組込みバイナリ配布前提）

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** @type {ReadonlySet<string>} */
export const ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'Unlicense',
  'CC0-1.0',
  'Zlib',
]);

/** @type {ReadonlySet<string>} */
export const CAUTION = new Set([
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
  'EPL-2.0',
]);

/** @type {ReadonlySet<string>} */
export const FORBIDDEN = new Set([
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'SSPL-1.0',
  'BSL-1.1',
  'EUPL-1.1',
  'EUPL-1.2',
]);

// よくある表記ゆれを SPDX 正規形に変換するマップ
const ALIASES = new Map([
  ['apache 2.0', 'Apache-2.0'],
  ['apache 2', 'Apache-2.0'],
  ['apache-2.0', 'Apache-2.0'],
  ['apache2', 'Apache-2.0'],
  ['mit', 'MIT'],
  ['bsd', 'BSD-2-Clause'],
  ['bsd-2-clause', 'BSD-2-Clause'],
  ['bsd-3-clause', 'BSD-3-Clause'],
  ['isc', 'ISC'],
  ['unlicense', 'Unlicense'],
  ['cc0', 'CC0-1.0'],
  ['cc0-1.0', 'CC0-1.0'],
  ['zlib', 'Zlib'],
  ['lgpl-2.1', 'LGPL-2.1'],
  ['lgpl-3.0', 'LGPL-3.0'],
  ['lgpl2.1', 'LGPL-2.1'],
  ['lgpl3', 'LGPL-3.0'],
  ['mpl-2.0', 'MPL-2.0'],
  ['epl-2.0', 'EPL-2.0'],
  ['gpl-2.0', 'GPL-2.0'],
  ['gpl-3.0', 'GPL-3.0'],
  ['gpl2', 'GPL-2.0'],
  ['gpl3', 'GPL-3.0'],
  ['agpl-3.0', 'AGPL-3.0'],
  ['sspl', 'SSPL-1.0'],
  ['sspl-1.0', 'SSPL-1.0'],
  ['bsl-1.1', 'BSL-1.1'],
  ['eupl-1.1', 'EUPL-1.1'],
  ['eupl-1.2', 'EUPL-1.2'],
]);

/**
 * ライセンス文字列を正規化する
 * @param {string} raw - npm info 等から取得した生のライセンス文字列
 * @returns {string} SPDX 正規形またはそのまま
 */
export function normalize(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // SPDX 識別子にそのまま合致する場合はそのまま返す
  if (ALLOWED.has(trimmed) || CAUTION.has(trimmed) || FORBIDDEN.has(trimmed)) {
    return trimmed;
  }

  // 小文字化してエイリアスマップを参照
  const lower = trimmed.toLowerCase();
  if (ALIASES.has(lower)) {
    return ALIASES.get(lower);
  }

  // 括弧内表現の除去 (e.g. "MIT License" → "MIT")
  const withoutSuffix = lower
    .replace(/\s+license$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (ALIASES.has(withoutSuffix)) {
    return ALIASES.get(withoutSuffix);
  }

  // マッチしなかった場合は元の trimmed を返す（unknown 扱いになる）
  return trimmed;
}

/**
 * ライセンスを分類する（デフォルトルール使用）
 * @param {string} license - 生のライセンス文字列
 * @returns {'allowed' | 'caution' | 'forbidden' | 'unknown'}
 */
export function classify(license) {
  const normalized = normalize(license);
  if (!normalized) return 'unknown';
  if (ALLOWED.has(normalized)) return 'allowed';
  if (CAUTION.has(normalized)) return 'caution';
  if (FORBIDDEN.has(normalized)) return 'forbidden';
  return 'unknown';
}

/**
 * .neko-policy/license-policy.json からカスタム分類器を読み込む
 * @returns {((license: string) => string) | null}
 */
export function loadPolicyClassifier() {
  try {
    const p = join(homedir(), '.neko-policy', 'license-policy.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    if (data.allowed || data.forbidden || data.caution) {
      return createClassifier(data);
    }
  } catch { /* policy not found or malformed */ }
  return null;
}

/**
 * 外部ルールファイルからカスタム分類器を作成する
 * 外部ルール指定時はデフォルトを完全上書き（マージしない）
 * @param {{ allowed?: string[], caution?: string[], forbidden?: string[] }} customRules
 * @returns {(license: string) => 'allowed' | 'caution' | 'forbidden' | 'unknown'}
 */
export function createClassifier(customRules) {
  const allowed = new Set(customRules.allowed || []);
  const caution = new Set(customRules.caution || []);
  const forbidden = new Set(customRules.forbidden || []);

  return function classifyCustom(license) {
    const normalized = normalize(license);
    if (!normalized) return 'unknown';
    if (allowed.has(normalized)) return 'allowed';
    if (caution.has(normalized)) return 'caution';
    if (forbidden.has(normalized)) return 'forbidden';
    return 'unknown';
  };
}
