// license-yoshi: rules.mjs のテスト
// node:test で classify 関数の全ライセンス種をカバー

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { classify, normalize, createClassifier } from '../src/rules.mjs';

describe('classify', () => {
  describe('allowed ライセンス', () => {
    const allowed = [
      'MIT',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'Apache-2.0',
      'ISC',
      'Unlicense',
      'CC0-1.0',
      'Zlib',
    ];

    for (const license of allowed) {
      it(`${license} -> allowed`, () => {
        assert.equal(classify(license), 'allowed');
      });
    }
  });

  describe('caution ライセンス', () => {
    const caution = [
      'LGPL-2.1',
      'LGPL-2.1-only',
      'LGPL-2.1-or-later',
      'LGPL-3.0',
      'LGPL-3.0-only',
      'LGPL-3.0-or-later',
      'MPL-2.0',
      'EPL-2.0',
    ];

    for (const license of caution) {
      it(`${license} -> caution`, () => {
        assert.equal(classify(license), 'caution');
      });
    }
  });

  describe('forbidden ライセンス', () => {
    const forbidden = [
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
    ];

    for (const license of forbidden) {
      it(`${license} -> forbidden`, () => {
        assert.equal(classify(license), 'forbidden');
      });
    }
  });

  describe('unknown ライセンス', () => {
    it('空文字 -> unknown', () => {
      assert.equal(classify(''), 'unknown');
    });

    it('null -> unknown', () => {
      assert.equal(classify(null), 'unknown');
    });

    it('undefined -> unknown', () => {
      assert.equal(classify(undefined), 'unknown');
    });

    it('不明なライセンス文字列 -> unknown', () => {
      assert.equal(classify('CustomLicense-1.0'), 'unknown');
    });

    it('PROPRIETARY -> unknown', () => {
      assert.equal(classify('PROPRIETARY'), 'unknown');
    });
  });

  describe('表記ゆれの正規化', () => {
    it('mit (小文字) -> allowed', () => {
      assert.equal(classify('mit'), 'allowed');
    });

    it('Apache 2.0 (スペース区切り) -> allowed', () => {
      assert.equal(classify('Apache 2.0'), 'allowed');
    });

    it('apache2 -> allowed', () => {
      assert.equal(classify('apache2'), 'allowed');
    });

    it('MIT License (suffix付き) -> allowed', () => {
      assert.equal(classify('MIT License'), 'allowed');
    });

    it('bsd -> allowed (BSD-2-Clause にマッピング)', () => {
      assert.equal(classify('bsd'), 'allowed');
    });

    it('gpl3 -> forbidden', () => {
      assert.equal(classify('gpl3'), 'forbidden');
    });

    it('lgpl2.1 -> caution', () => {
      assert.equal(classify('lgpl2.1'), 'caution');
    });

    it('sspl -> forbidden', () => {
      assert.equal(classify('sspl'), 'forbidden');
    });

    it('cc0 -> allowed', () => {
      assert.equal(classify('cc0'), 'allowed');
    });
  });
});

describe('normalize', () => {
  it('空文字 -> 空文字', () => {
    assert.equal(normalize(''), '');
  });

  it('null -> 空文字', () => {
    assert.equal(normalize(null), '');
  });

  it('前後空白を除去', () => {
    assert.equal(normalize('  MIT  '), 'MIT');
  });

  it('SPDX 正規形はそのまま返す', () => {
    assert.equal(normalize('Apache-2.0'), 'Apache-2.0');
  });

  it('小文字エイリアスを正規化', () => {
    assert.equal(normalize('apache 2.0'), 'Apache-2.0');
  });

  it('License サフィックスを除去', () => {
    assert.equal(normalize('ISC License'), 'ISC');
  });

  it('不明な文字列はそのまま返す', () => {
    assert.equal(normalize('SomeCustom-3.0'), 'SomeCustom-3.0');
  });
});

describe('parseDiffForAddedDeps', async () => {
  const { parseDiffForAddedDeps } = await import('../src/detector.mjs');

  it('追加行からパッケージ名を抽出', () => {
    const diff = `--- a/package.json
+++ b/package.json
@@ -10,6 +10,8 @@
   "dependencies": {
     "existing-pkg": "^1.0.0",
+    "new-pkg": "^2.0.0",
+    "@scope/new-pkg": "^1.0.0"
   }`;
    const result = parseDiffForAddedDeps(diff);
    assert.deepEqual(result, ['new-pkg', '@scope/new-pkg']);
  });

  it('メタフィールドは除外', () => {
    const diff = `+++ b/package.json
+    "name": "my-app",
+    "version": "1.0.0",
+    "lodash": "^4.0.0"`;
    const result = parseDiffForAddedDeps(diff);
    assert.deepEqual(result, ['lodash']);
  });

  it('削除行は無視', () => {
    const diff = `+++ b/package.json
-    "removed-pkg": "^1.0.0",
+    "added-pkg": "^2.0.0"`;
    const result = parseDiffForAddedDeps(diff);
    assert.deepEqual(result, ['added-pkg']);
  });

  it('空の diff -> 空配列', () => {
    assert.deepEqual(parseDiffForAddedDeps(''), []);
  });
});

describe('loadAllowlist', async () => {
  const { loadAllowlist } = await import('../src/detector.mjs');
  const { writeFileSync, unlinkSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  it('ファイルが存在しない場合は空セット', () => {
    const result = loadAllowlist(join(tmpdir(), 'nonexistent-dir-license-yoshi'));
    assert.equal(result.size, 0);
  });

  it('allowlist ファイルからパッケージ名を読み込む', () => {
    const dir = join(tmpdir(), 'license-yoshi-test-allow');
    mkdirSync(dir, { recursive: true });
    const allowPath = join(dir, '.license-yoshi-allow');
    writeFileSync(allowPath, '# コメント行\npkg-a\npkg-b\n\n# もう一つのコメント\n@scope/pkg-c\n');

    const result = loadAllowlist(dir);
    assert.equal(result.size, 3);
    assert.ok(result.has('pkg-a'));
    assert.ok(result.has('pkg-b'));
    assert.ok(result.has('@scope/pkg-c'));

    unlinkSync(allowPath);
  });
});

describe('createClassifier', () => {
  it('カスタムルールでデフォルトを完全上書き', () => {
    const custom = createClassifier({
      allowed: ['CustomA'],
      caution: ['CustomB'],
      forbidden: ['MIT'],  // デフォルトでは allowed だが、カスタムで forbidden に
    });

    assert.equal(custom('CustomA'), 'allowed');
    assert.equal(custom('CustomB'), 'caution');
    assert.equal(custom('MIT'), 'forbidden');  // 上書きが効いている
    assert.equal(custom('Apache-2.0'), 'unknown');  // デフォルトにあるがカスタムにはない
  });

  it('空のカテゴリは空として扱う', () => {
    const custom = createClassifier({
      allowed: ['MIT'],
    });

    assert.equal(custom('MIT'), 'allowed');
    assert.equal(custom('GPL-3.0'), 'unknown');  // forbidden が定義されていないので unknown
  });

  it('normalize 経由の表記ゆれ解決が効く', () => {
    const custom = createClassifier({
      allowed: ['Apache-2.0'],
    });

    // "apache 2.0" は normalize で "Apache-2.0" に正規化される
    assert.equal(custom('apache 2.0'), 'allowed');
  });
});
