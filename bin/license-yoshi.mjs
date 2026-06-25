#!/usr/bin/env node
// license-yoshi: 依存ライセンスチェッカー CLI
// code-provenance.md 準拠のライセンス判定を pre-commit hook で自動実行

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { detectAddedDeps, getAllDeps, loadAllowlist } from '../src/detector.mjs';
import { checkLicenses } from '../src/checker.mjs';
import { createClassifier } from '../src/rules.mjs';
import { appendLog } from '../src/log.mjs';

function printUsage() {
  console.log(`license-yoshi v0.2.0 - 依存ライセンスチェッカー

Usage:
  license-yoshi [options]

Options:
  --dir <path>         対象ディレクトリ (default: cwd)
  --cached             git diff --cached で追加された依存のみチェック (default)
  --all                全依存をチェック
  --rules <path>       カスタムルールファイル (JSON) を指定
  --strict             期限切れ allowlist エントリを FAIL 扱いにする
  --json               結果を JSON 形式で出力する
  --help               ヘルプ表示

Allowlist file (.license-yoshi-allow.json):
  [
    { "pkg": "some-pkg", "reason": "内部利用のみ", "approved_by": "aliksir", "expires": "2027-01-01" }
  ]

Exit codes:
  0  全て許可 or 要注意のみ
  1  禁止 or 不明のライセンスが検出された`);
}

function parseArgs(argv) {
  const args = { dir: process.cwd(), mode: 'cached', help: false, rulesPath: null, strict: false, json: false };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--dir':
        i++;
        if (i < argv.length) args.dir = resolve(argv[i]);
        break;
      case '--cached':
        args.mode = 'cached';
        break;
      case '--all':
        args.mode = 'all';
        break;
      case '--rules':
        i++;
        if (i < argv.length) args.rulesPath = resolve(argv[i]);
        break;
      case '--strict':
        args.strict = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        console.error(`Unknown option: ${argv[i]}`);
        process.exit(1);
    }
  }

  return args;
}

/**
 * カスタムルールファイルを読み込んで分類器を返す
 * @param {string} rulesPath
 * @returns {((license: string) => string) | null}
 */
function loadCustomRules(rulesPath) {
  try {
    const raw = readFileSync(rulesPath, 'utf-8');
    const rules = JSON.parse(raw);

    // 最低限のバリデーション
    if (typeof rules !== 'object' || rules === null) {
      console.error(`ERROR: ルールファイルの形式が不正です: ${rulesPath}`);
      process.exit(1);
    }

    const hasAny = rules.allowed || rules.caution || rules.forbidden;
    if (!hasAny) {
      console.error(`ERROR: ルールファイルに allowed / caution / forbidden のいずれも定義されていません: ${rulesPath}`);
      process.exit(1);
    }

    console.log(`license-yoshi: カスタムルール読み込み: ${rulesPath}`);
    return createClassifier(rules);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`ERROR: ルールファイルが見つかりません: ${rulesPath}`);
    } else if (err instanceof SyntaxError) {
      console.error(`ERROR: ルールファイルの JSON パースに失敗: ${rulesPath}`);
    } else {
      console.error(`ERROR: ルールファイル読み込み失敗: ${err.message}`);
    }
    process.exit(1);
  }
}

function formatVerdict(verdict) {
  switch (verdict) {
    case 'allowed':   return '\x1b[32mALLOWED\x1b[0m';
    case 'caution':   return '\x1b[33mCAUTION\x1b[0m';
    case 'forbidden': return '\x1b[31mFORBIDDEN\x1b[0m';
    case 'unknown':   return '\x1b[31mUNKNOWN\x1b[0m';
    default:          return verdict;
  }
}

const _start = Date.now();
let _severity = 'info';
let _summary = { forbidden: 0, caution: 0, allowed: 0, expired_allowlist: 0 };

process.on('exit', (code) => {
  appendLog({
    schema_version: '1.1',
    tool: 'license-yoshi',
    command: 'check',
    ts: new Date().toISOString(),
    duration_ms: Date.now() - _start,
    exit_code: code,
    severity: _severity,
    summary: _summary,
    meta: {},
  });
});

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // カスタムルールの読み込み
  const classifierFn = args.rulesPath ? loadCustomRules(args.rulesPath) : null;

  // パッケージ名リストを取得
  let packages;
  if (args.mode === 'all') {
    packages = getAllDeps(args.dir);
    if (packages.length === 0) {
      console.log('license-yoshi: package.json に依存がありません');
      process.exit(0);
    }
  } else {
    packages = detectAddedDeps(args.dir);
    if (packages.length === 0) {
      console.log('license-yoshi: 新規追加された依存はありません');
      process.exit(0);
    }
  }

  // allowlist 読み込み
  const allowlist = loadAllowlist(args.dir);

  // allowlist パッケージを分離（記録は残す）
  const allowedByList = [];
  const filtered = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const pkg of packages) {
    if (allowlist.has(pkg)) {
      const entry = allowlist.get(pkg);
      const expired = args.strict && entry.expires && entry.expires < today;
      allowedByList.push({ name: pkg, status: expired ? 'expired' : 'allowed', ...entry });
      if (expired) {
        filtered.push(pkg);
      }
    } else {
      filtered.push(pkg);
    }
  }

  // ライセンスチェック実行
  const results = filtered.length > 0 ? checkLicenses(filtered, classifierFn) : [];

  if (!args.json) {
    console.log(`license-yoshi: ${packages.length} 件の依存をチェック中...`);
    console.log('');
  }

  // 結果表示
  let hasForbidden = false;
  let hasUnknown = false;
  let cautionCount = 0;
  let expiredCount = 0;

  if (!args.json) {
    for (const a of allowedByList) {
      if (a.status === 'expired') {
        console.log(`  ${a.name}: allowlist \x1b[31m期限切れ (${a.expires})\x1b[0m — 通常チェックに戻します`);
        expiredCount++;
      } else {
        const reason = a.reason ? ` (${a.reason})` : '';
        console.log(`  ${a.name}: allowlist${reason} -> \x1b[36mALLOWED\x1b[0m`);
      }
    }
  }

  for (const r of results) {
    if (!args.json) {
      const verdictStr = formatVerdict(r.verdict);
      console.log(`  ${r.name}: ${r.license} -> ${verdictStr}`);
    }
    if (r.verdict === 'forbidden') hasForbidden = true;
    if (r.verdict === 'unknown') hasUnknown = true;
    if (r.verdict === 'caution') cautionCount++;
  }

  // JSON 出力
  if (args.json) {
    const allResults = [
      ...allowedByList.filter(a => a.status !== 'expired').map(a => ({
        name: a.name, license: null, verdict: 'allowed', status: 'allowed',
        reason: a.reason, approved_by: a.approved_by, expires: a.expires,
      })),
      ...results.map(r => ({ ...r, status: 'checked' })),
    ];
    console.log(JSON.stringify({ total: allResults.length, results: allResults, expired: expiredCount }, null, 2));

    // Schema v1.1: update module-scope stats for JSON path
    const jForbidden = results.filter(r => r.verdict === "forbidden").length;
    const jUnknown = results.filter(r => r.verdict === "unknown").length;
    const jCaution = results.filter(r => r.verdict === "caution").length;
    const jAllowed = results.filter(r => r.verdict === "allowed").length + allowedByList.filter(a => a.status !== "expired").length;
    _summary = { forbidden: jForbidden + jUnknown, caution: jCaution, allowed: jAllowed, expired_allowlist: allowedByList.filter(a => a.status === "expired").length };
    _severity = (jForbidden + jUnknown) > 0 ? "block" : jCaution > 0 ? "warn" : "info";
    if (hasForbidden || hasUnknown) process.exit(1);
    process.exit(0);
  }

  console.log('');

  // サマリー
  const total = results.length + allowedByList.filter(a => a.status !== 'expired').length;
  const allowedCount = results.filter((r) => r.verdict === 'allowed').length + allowedByList.filter(a => a.status !== 'expired').length;
  const forbiddenCount = results.filter((r) => r.verdict === 'forbidden').length;
  const unknownCount = results.filter((r) => r.verdict === 'unknown').length;

  // Schema v1.1: update module-scope stats variables
  _summary = { forbidden: forbiddenCount + unknownCount, caution: cautionCount, allowed: allowedCount, expired_allowlist: expiredCount };
  _severity = (forbiddenCount + unknownCount) > 0 ? 'block' : cautionCount > 0 ? 'warn' : 'info';

  console.log(`結果: ${total} 件中 — 許可: ${allowedCount}, 要注意: ${cautionCount}, 禁止: ${forbiddenCount}, 不明: ${unknownCount}`);
  if (expiredCount > 0) {
    console.log(`  \x1b[31mallowlist 期限切れ: ${expiredCount} 件（--strict で FAIL 扱い）\x1b[0m`);
  }

  if (hasForbidden || hasUnknown) {
    console.log('');
    console.error('\x1b[31mERROR: 禁止または不明なライセンスが検出されました。コミットをブロックします。\x1b[0m');
    if (hasUnknown) {
      console.error('  不明なライセンス = 禁止扱い（code-provenance.md 準拠）');
    }
    console.error('  例外許可する場合は .license-yoshi-allow.json にエントリを追加してください');
    process.exit(1);
  }

  if (cautionCount > 0) {
    console.log('');
    console.warn('\x1b[33mWARNING: 要注意ライセンスが含まれています。組込みでは原則禁止です。\x1b[0m');
    console.warn('  総司令承認で例外可。.license-yoshi-allow.json に追加で警告を抑制できます');
  }

  console.log('');
  console.log('license-yoshi: チェック完了');
}

main();
