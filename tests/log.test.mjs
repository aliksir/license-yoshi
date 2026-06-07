import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, rmSync, renameSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { appendLog } from '../src/log.mjs';

const LOG_DIR = join(homedir(), '.neko-hq');
const LOG_FILE = join(LOG_DIR, 'stats.jsonl');

describe('appendLog', () => {
  it('writes a valid JSONL entry and can be parsed back', () => {
    const backup = LOG_FILE + '.bak-' + Date.now();
    const hadFile = existsSync(LOG_FILE);
    if (hadFile) renameSync(LOG_FILE, backup);

    try {
      const entry = {
        tool: 'license-yoshi',
        command: 'test',
        ts: '2026-01-01T00:00:00.000Z',
        duration_ms: 42,
        exit_code: 0,
        meta: {},
      };
      appendLog(entry);

      assert.ok(existsSync(LOG_FILE), 'stats.jsonl should exist after appendLog');
      const content = readFileSync(LOG_FILE, 'utf8').trim();
      const parsed = JSON.parse(content);
      assert.equal(parsed.tool, 'license-yoshi');
      assert.equal(parsed.command, 'test');
      assert.equal(parsed.duration_ms, 42);
      assert.equal(parsed.exit_code, 0);
    } finally {
      if (existsSync(LOG_FILE)) rmSync(LOG_FILE);
      if (existsSync(backup)) renameSync(backup, LOG_FILE);
    }
  });

  it('appends without overwriting existing entries', () => {
    const backup = LOG_FILE + '.bak-' + Date.now();
    const hadFile = existsSync(LOG_FILE);
    if (hadFile) renameSync(LOG_FILE, backup);

    try {
      appendLog({ tool: 'a', command: '1', ts: '', duration_ms: 1, exit_code: 0, meta: {} });
      appendLog({ tool: 'b', command: '2', ts: '', duration_ms: 2, exit_code: 0, meta: {} });

      const lines = readFileSync(LOG_FILE, 'utf8').trim().split('\n');
      assert.equal(lines.length, 2);
      assert.equal(JSON.parse(lines[0]).tool, 'a');
      assert.equal(JSON.parse(lines[1]).tool, 'b');
    } finally {
      if (existsSync(LOG_FILE)) rmSync(LOG_FILE);
      if (existsSync(backup)) renameSync(backup, LOG_FILE);
    }
  });
});
