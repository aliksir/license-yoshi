// license-yoshi: パッケージライセンスチェッカー
// npm info {pkg} license を execFileSync で実行（shell injection 防止）

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { classify } from './rules.mjs';

const CACHE_PATH = join(homedir(), '.license-yoshi-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * キャッシュを読み込む
 * @returns {Record<string, { license: string, ts: number }>}
 */
function loadCache() {
  try {
    if (!existsSync(CACHE_PATH)) return {};
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * キャッシュを保存する
 * @param {Record<string, { license: string, ts: number }>} cache
 */
function saveCache(cache) {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // キャッシュ書き込み失敗は致命的ではない
  }
}

/**
 * npm info でライセンスを取得する
 * @param {string} packageName
 * @returns {string} ライセンス文字列（取得失敗時は空文字）
 */
function fetchLicenseFromNpm(packageName) {
  try {
    const result = execFileSync('npm', ['info', packageName, 'license'], {
      encoding: 'utf-8',
      timeout: 30_000,
      windowsHide: true,
    });
    return result.trim();
  } catch {
    return '';
  }
}

/**
 * パッケージのライセンスをチェックする
 * @param {string} packageName
 * @param {((license: string) => string)?} classifierFn - カスタム分類関数（省略時はデフォルト）
 * @returns {{ name: string, license: string, verdict: 'allowed' | 'caution' | 'forbidden' | 'unknown' }}
 */
export function checkLicense(packageName, classifierFn) {
  const classifyFn = classifierFn || classify;
  const cache = loadCache();
  const now = Date.now();

  // キャッシュに有効なエントリがあればそれを使う
  if (cache[packageName] && (now - cache[packageName].ts) < CACHE_TTL_MS) {
    const license = cache[packageName].license;
    return { name: packageName, license, verdict: classifyFn(license) };
  }

  // npm info で取得
  const license = fetchLicenseFromNpm(packageName);

  // キャッシュに保存
  cache[packageName] = { license, ts: now };
  saveCache(cache);

  return { name: packageName, license: license || '(none)', verdict: classifyFn(license) };
}

/**
 * 複数パッケージのライセンスを一括チェックする
 * @param {string[]} packageNames
 * @param {((license: string) => string)?} classifierFn - カスタム分類関数（省略時はデフォルト）
 * @returns {Array<{ name: string, license: string, verdict: string }>}
 */
export function checkLicenses(packageNames, classifierFn) {
  return packageNames.map((name) => checkLicense(name, classifierFn));
}
