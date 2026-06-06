// license-yoshi: 追加依存パッケージ検出
// git diff --cached (staged) または全依存スキャンで追加パッケージ名を抽出

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * git diff --cached から package.json の追加行を解析し、
 * dependencies / devDependencies に追加されたパッケージ名を返す
 * @param {string} dir - プロジェクトディレクトリ
 * @returns {string[]} 追加されたパッケージ名の配列
 */
export function detectAddedDeps(dir) {
  try {
    const diff = execFileSync(
      'git',
      ['diff', '--cached', '--unified=0', '--', 'package.json'],
      { cwd: dir, encoding: 'utf-8', timeout: 10_000, windowsHide: true }
    );
    return parseDiffForAddedDeps(diff);
  } catch {
    return [];
  }
}

/**
 * git diff の出力から追加されたパッケージ名を抽出する
 * @param {string} diffOutput - git diff の出力
 * @returns {string[]}
 */
export function parseDiffForAddedDeps(diffOutput) {
  const added = [];
  // 追加行（+ で始まる行）から "package-name": "version" パターンを抽出
  // dependencies / devDependencies ブロック内の行を対象とする
  const addedLineRegex = /^\+\s*"([^"]+)"\s*:\s*"[^"]*"/;

  for (const line of diffOutput.split('\n')) {
    // +++ で始まるヘッダ行はスキップ
    if (line.startsWith('+++')) continue;
    // + で始まる追加行のみ対象
    if (!line.startsWith('+')) continue;

    const match = line.match(addedLineRegex);
    if (match) {
      const name = match[1];
      // package.json のメタフィールドは除外
      // npm パッケージ名は @ で始まるか、小文字英数字で始まる
      if (isPackageName(name)) {
        added.push(name);
      }
    }
  }

  return added;
}

/**
 * package.json の全依存パッケージ名を取得する
 * @param {string} dir - プロジェクトディレクトリ
 * @returns {string[]}
 */
export function getAllDeps(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return [];

  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    return [...deps, ...devDeps];
  } catch {
    return [];
  }
}

/**
 * npm パッケージ名として妥当かどうかを簡易判定する
 * package.json のトップレベルフィールド (name, version, scripts 等) を除外
 * @param {string} name
 * @returns {boolean}
 */
function isPackageName(name) {
  // スコープ付きパッケージ (@org/pkg)
  if (name.startsWith('@') && name.includes('/')) return true;
  // package.json の既知メタフィールドを除外
  const metaFields = new Set([
    'name', 'version', 'description', 'main', 'module', 'type', 'types',
    'scripts', 'bin', 'files', 'repository', 'keywords', 'author',
    'license', 'bugs', 'homepage', 'engines', 'private', 'publishConfig',
    'workspaces', 'exports', 'imports', 'dependencies', 'devDependencies',
    'peerDependencies', 'optionalDependencies', 'bundleDependencies',
    'overrides', 'resolutions', 'packageManager',
  ]);
  if (metaFields.has(name)) return false;
  // npm パッケージ名は小文字英数字・ハイフン・ドット・アンダースコアで構成
  return /^[a-z0-9@][a-z0-9._-]*$/.test(name);
}

/**
 * allowlist ファイルを読み込む
 * @param {string} dir - プロジェクトディレクトリ
 * @returns {Set<string>} 許可されたパッケージ名のセット
 */
export function loadAllowlist(dir) {
  const allowPath = join(dir, '.license-yoshi-allow');
  if (!existsSync(allowPath)) return new Set();

  try {
    const raw = readFileSync(allowPath, 'utf-8');
    const names = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    return new Set(names);
  } catch {
    return new Set();
  }
}
