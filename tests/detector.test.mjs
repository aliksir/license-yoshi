// license-yoshi: detector.mjs テスト
// execFn DI パターンで git 呼び出しをスタブ化

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAddedDeps, parseDiffForAddedDeps } from '../src/detector.mjs';

// git diff の応答をシミュレートするスタブファクトリ
function makeGitExecFn(diffOutput) {
  return function stubGit(_cmd, _args, _opts) {
    if (diffOutput === null) throw new Error('git command failed');
    return diffOutput;
  };
}

// 典型的な package.json diff（express を追加した例）
// 削除行（-lodash）はそのまま残り、追加行（+express）だけ新規
const TYPICAL_DIFF = `diff --git a/package.json b/package.json
index abc123..def456 100644
--- a/package.json
+++ b/package.json
@@ -5,5 +5,6 @@
   "dependencies": {
     "lodash": "^4.0.0",
+    "express": "^4.18.0"
   }
 }
`;

const MULTI_DIFF = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,3 +1,6 @@
   "dependencies": {
+    "react": "^18.0.0",
+    "react-dom": "^18.0.0"
+  },
+  "devDependencies": {
+    "jest": "^29.0.0"
   }
`;

describe('detectAddedDeps', () => {
  it('diff で依存追加を検出する', () => {
    const execFn = makeGitExecFn(TYPICAL_DIFF);
    const deps = detectAddedDeps('/fake/dir', execFn);
    assert.deepEqual(deps, ['express']);
  });

  it('diff なし（変更なし）-> 空配列', () => {
    const execFn = makeGitExecFn('');
    const deps = detectAddedDeps('/fake/dir', execFn);
    assert.deepEqual(deps, []);
  });

  it('git コマンド失敗 -> 空配列（エラー握りつぶし）', () => {
    const execFn = makeGitExecFn(null);
    const deps = detectAddedDeps('/fake/dir', execFn);
    assert.deepEqual(deps, []);
  });

  it('複数依存追加を一括検出する', () => {
    const execFn = makeGitExecFn(MULTI_DIFF);
    const deps = detectAddedDeps('/fake/dir', execFn);
    assert.deepEqual(deps, ['react', 'react-dom', 'jest']);
  });
});

describe('parseDiffForAddedDeps（追加エッジケース）', () => {
  it('削除行（- で始まる行）は含まない', () => {
    const diff = `+++ b/package.json
-    "old-pkg": "^1.0.0"
+    "new-pkg": "^2.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['new-pkg']);
  });

  it('+++ ヘッダ行はスキップする', () => {
    const diff = `+++ b/package.json
+    "some-pkg": "^1.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['some-pkg']);
  });

  it('メタフィールド（name, version, description 等）は除外する', () => {
    const diff = `+    "name": "my-app"
+    "version": "1.0.0"
+    "description": "some desc"
+    "scripts": {}
+    "real-pkg": "^1.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['real-pkg']);
  });

  it('スコープ付きパッケージ（@org/pkg）を検出する', () => {
    const diff = `+    "@babel/core": "^7.0.0"
+    "@types/node": "^20.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['@babel/core', '@types/node']);
  });

  it('大文字パッケージ名を検出する（regex修正の検証）', () => {
    // npm 旧パッケージには大文字が含まれるものがある（例: Foo, BigInteger）
    const diff = `+    "BigInteger": "^1.0.0"
+    "Foo-Bar": "^2.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['BigInteger', 'Foo-Bar']);
  });

  it('大文字スコープ付きパッケージを検出する', () => {
    const diff = `+    "@Scope/Bar": "^1.0.0"
`;
    const deps = parseDiffForAddedDeps(diff);
    assert.deepEqual(deps, ['@Scope/Bar']);
  });
});
