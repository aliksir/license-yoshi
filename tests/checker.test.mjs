// license-yoshi: checker.mjs テスト
// execFn DI パターンで npm 呼び出しをスタブ化

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkLicense, checkLicenses } from '../src/checker.mjs';

// npm info の応答をシミュレートするスタブファクトリ
function makeExecFn(licenseByPkg) {
  return function stubExec(_cmd, args, _opts) {
    // args: ['info', '<pkg>', 'license']
    const pkg = args[1];
    if (pkg in licenseByPkg) {
      const val = licenseByPkg[pkg];
      if (val === null) throw new Error('npm info failed');
      return val + '\n';
    }
    throw new Error('unexpected package: ' + pkg);
  };
}

describe('checkLicense', () => {
  it('MIT パッケージ -> allowed 判定', () => {
    const execFn = makeExecFn({ 'some-mit-pkg': 'MIT' });
    const result = checkLicense('some-mit-pkg', null, {}, execFn);
    assert.equal(result.name, 'some-mit-pkg');
    assert.equal(result.license, 'MIT');
    assert.equal(result.verdict, 'allowed');
  });

  it('GPL パッケージ -> forbidden 判定', () => {
    const execFn = makeExecFn({ 'some-gpl-pkg': 'GPL-3.0' });
    const result = checkLicense('some-gpl-pkg', null, {}, execFn);
    assert.equal(result.license, 'GPL-3.0');
    assert.equal(result.verdict, 'forbidden');
  });

  it('不明ライセンス -> unknown 判定（forbidden 扱い）', () => {
    const execFn = makeExecFn({ 'mystery-pkg': 'PROPRIETARY' });
    const result = checkLicense('mystery-pkg', null, {}, execFn);
    assert.equal(result.verdict, 'unknown');
  });

  it('npm info 失敗 -> (none) ライセンス・unknown 判定', () => {
    const execFn = makeExecFn({ 'broken-pkg': null });
    const result = checkLicense('broken-pkg', null, {}, execFn);
    assert.equal(result.license, '(none)');
    assert.equal(result.verdict, 'unknown');
  });

  it('キャッシュヒット時は execFn を呼ばない', () => {
    let called = false;
    const execFn = () => { called = true; return 'MIT\n'; };
    const cache = { 'cached-pkg': { license: 'Apache-2.0', ts: Date.now() } };
    const result = checkLicense('cached-pkg', null, cache, execFn);
    assert.equal(called, false);
    assert.equal(result.verdict, 'allowed');
  });
});

describe('checkLicenses', () => {
  it('複数パッケージ一括処理', () => {
    const execFn = makeExecFn({
      'pkg-a': 'MIT',
      'pkg-b': 'GPL-3.0',
      'pkg-c': 'ISC',
    });
    // checkLicenses は内部でキャッシュ I/O するが execFn でスタブ化
    // loadCache / saveCache は実ファイルを参照するため、空キャッシュ相当になる
    const results = checkLicenses(['pkg-a', 'pkg-b', 'pkg-c'], null, execFn);
    assert.equal(results.length, 3);
    assert.equal(results[0].verdict, 'allowed');
    assert.equal(results[1].verdict, 'forbidden');
    assert.equal(results[2].verdict, 'allowed');
  });

  it('空配列 -> 空結果', () => {
    const execFn = makeExecFn({});
    const results = checkLicenses([], null, execFn);
    assert.deepEqual(results, []);
  });
});
