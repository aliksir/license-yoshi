# license-yoshi
> [neko-HQ](https://github.com/aliksir/neko-hq) エコシステムの一部です。

Node.js プロジェクトの依存ライセンスチェッカー。npm パッケージのライセンスを 4 段階（許可 / 要注意 / 禁止 / 不明）に分類し、禁止または不明なライセンスを含むコミットをブロックします。

依存ゼロ。Node.js 組み込みモジュールのみ使用。

## クイックスタート

```bash
# 全依存をチェック
npx license-yoshi --all

# git staged の追加依存のみチェック
npx license-yoshi --cached

# ディレクトリ指定
npx license-yoshi --all --dir /path/to/project
```

## インストール

```bash
npm install -g license-yoshi
# または devDependencies として
npm install --save-dev license-yoshi
```

## CLI 使用方法

```
license-yoshi [options]

Options:
  --dir <path>         対象ディレクトリ (default: cwd)
  --cached             git diff --cached で追加された依存のみチェック (default)
  --all                全依存をチェック
  --rules <path>       カスタムルールファイル (JSON) を指定
  --strict             期限切れ allowlist エントリを FAIL 扱いにする
  --json               結果を JSON 形式で出力する
  --help               ヘルプ表示
```

### 終了コード

| コード | 意味 |
|--------|------|
| 0 | 全て許可 or 要注意のみ |
| 1 | 禁止 or 不明のライセンスが検出された |

## ライセンス分類

デフォルトルールは組込みバイナリ配布前提の分類（code-provenance.md 準拠）:

| 分類 | ライセンス | 動作 |
|------|-----------|------|
| **許可** | MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, Unlicense, CC0-1.0, Zlib | 通過 |
| **要注意** | LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-2.0 | 警告表示（ブロックしない） |
| **禁止** | GPL-2.0, GPL-3.0, AGPL-3.0, SSPL-1.0, BSL-1.1, EUPL-1.1/1.2 | ブロック (exit 1) |
| **不明** | ライセンスなし / 判定不能 | ブロック (exit 1) |

## Pre-commit Hook 設定

### Husky の場合

```bash
npx husky add .husky/pre-commit "npx license-yoshi --cached"
```

### 手動設定

`.git/hooks/pre-commit` に追加:

```bash
#!/bin/sh
npx license-yoshi --cached
```

## カスタムルール

JSON ファイルでデフォルトルールを上書き:

```json
{
  "allowed": ["MIT", "Apache-2.0", "ISC"],
  "caution": ["LGPL-3.0"],
  "forbidden": ["GPL-3.0", "AGPL-3.0"]
}
```

```bash
license-yoshi --all --rules my-rules.json
```

`--rules` 指定時はデフォルトルールを**完全上書き**（マージしない）。

## Allowlist

### JSON形式（推奨）

`.license-yoshi-allow.json` で監査対応のメタデータ付き allowlist:

```json
[
  { "pkg": "some-gpl-package", "reason": "内部利用のみ", "approved_by": "admin", "expires": "2027-01-01" },
  { "pkg": "@scope/special-package", "reason": "評価済み" }
]
```

allowlist パッケージも `status: "allowed"` として出力に記録されます。
`--strict` で期限切れエントリを FAIL 扱いにできます。

### テキスト形式（レガシー）

`.license-yoshi-allow`（1行1パッケージ名、`#` コメント可）。両方存在する場合は JSON 優先。

## キャッシュ

ライセンス情報は `~/.license-yoshi-cache.json` に 7 日間キャッシュされます。削除すると再取得します。

## 動作要件

- Node.js 18+
- git（`--cached` モードで `git diff` を使用）

## ライセンス

MIT
