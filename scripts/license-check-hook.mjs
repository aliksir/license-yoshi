#!/usr/bin/env node
// license-yoshi: Claude Code PreToolUse hook
// git commit コマンドを検出した時にライセンスチェックを実行する

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'bin', 'license-yoshi.mjs');

// stdin から hook 入力を読み込む
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

try {
  const event = JSON.parse(input);

  // Bash ツール呼び出しのみ対象
  if (event.tool_name !== 'Bash') {
    // 関係ないツールはスルー
    console.log(JSON.stringify({ result: 'approve' }));
    process.exit(0);
  }

  const command = event.tool_input?.command || '';

  // git commit コマンドを検出
  const isGitCommit = /\bgit\s+commit\b/.test(command);
  if (!isGitCommit) {
    console.log(JSON.stringify({ result: 'approve' }));
    process.exit(0);
  }

  // ライセンスチェックを実行
  try {
    execFileSync('node', [CLI_PATH, '--cached'], {
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: 'pipe',
      windowsHide: true,
    });

    // チェック通過
    console.log(JSON.stringify({ result: 'approve' }));
  } catch (err) {
    // exit 1 = 禁止/不明ライセンス検出
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(JSON.stringify({
      result: 'block',
      reason: `license-yoshi: 禁止または不明なライセンスが検出されました。\n${output.trim()}`,
    }));
  }
} catch {
  // JSON パース失敗等はスルー
  console.log(JSON.stringify({ result: 'approve' }));
}
