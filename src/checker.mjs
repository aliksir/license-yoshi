// license-yoshi: パッケージライセンスチェッカー
// npm info {pkg} license を execFileSync で実行（shell injection 防止）

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { classify, loadPolicyClassifier } from './rules.mjs';

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
 * @param {Function | null} execFn - DI用実行関数（null なら実際の execFileSync を使う）
 * @returns {string} ライセンス文字列（取得失敗時は空文字）
 */
function fetchLicenseFromNpm(packageName, execFn) {
  try {
    const fn = execFn || execFileSync;
    const result = fn('npm', ['info', packageName, 'license'], {
      encoding: 'utf-8',
      timeout: 30_000,
      windowsHide: true,
    });
    return typeof result === 'string' ? result.trim() : '';
  } catch {
    return '';
  }
}

/**
 * パッケージのライセンスをチェックする
 * @param {string} packageName
 * @param {((license: string) => string) | null} classifierFn - カスタム分類関数（省略時はデフォルト）
 * @param {Record<string, { license: string, ts: number }> | undefined} cache - 共有キャッシュ
 * @param {Function | null} execFn - DI用実行関数（テスト時にnpmをスタブ化）
 * @returns {{ name: string, license: string, verdict: 'allowed' | 'caution' | 'forbidden' | 'unknown' }}
 */
export function checkLicense(packageName, classifierFn, cache, execFn = null) {
  const classifyFn = classifierFn || loadPolicyClassifier() || classify;
  const ownCache = cache === undefined;
  if (ownCache) cache = loadCache();
  const now = Date.now();

  if (cache[packageName] && (now - cache[packageName].ts) < CACHE_TTL_MS) {
    const license = cache[packageName].license;
    return { name: packageName, license, verdict: classifyFn(license) };
  }

  const license = fetchLicenseFromNpm(packageName, execFn);
  cache[packageName] = { license, ts: now };
  if (ownCache) saveCache(cache);

  return { name: packageName, license: license || '(none)', verdict: classifyFn(license) };
}

/**
 * 複数パッケージのライセンスを一括チェックする（キャッシュ I/O は 1 回）
 * @param {string[]} packageNames
 * @param {((license: string) => string) | null} classifierFn
 * @param {Function | null} execFn - DI用実行関数（テスト時にnpmをスタブ化）
 * @returns {Array<{ name: string, license: string, verdict: string }>}
 */
export function checkLicenses(packageNames, classifierFn, execFn = null) {
  const cache = loadCache();
  const results = packageNames.map((name) => checkLicense(name, classifierFn, cache, execFn));
  saveCache(cache);
  return results;
}
