# chart-lib


- **低レベル API** (`ChartRenderer`): キャンバスに直接描画する Pixi レンダラ
- **高レベル API** (`Chart`): リサイズ / クロスヘアまで面倒を見る薄いラッパー
- **ユーティリティ**: d3 スケール計算、共有ティッカー

ビルドステップは不要で、既存の静的 HTML にそのまま `<script>` で差し込めます。

> **Note:** デモデータ生成（ランダムウォーク OHLC）はライブラリには含まれていません。
> デモ用のデータ生成コードは `chart-lib-demo.html` を参照してください。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `chart-lib.js` | ライブラリ本体 (`window.ChartLib` を公開) |
| `chart-lib-demo.html` | デモページ (9 インストゥルメント・リアルタイム更新・レスポンシブ対応) |
| `chart-lib.md` | このドキュメント |

---

## 依存関係

`chart-lib.js` を読み込む **前に** 以下を読み込んでください。

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js"></script>
<script src="./chart-lib.js"></script>
```

- **d3 v7** — スケール計算のみ使用 (DOM 操作は一切しません)
- **PixiJS v7** — 実際のキャンバス描画

どちらかが未ロードの場合、`chart-lib.js` は `console.warn` を出します。

---

## クイックスタート (高レベル API)

```html
<div id="chart" style="width: 600px; height: 360px;"></div>

<script>
  // OHLC データは利用者が用意する
  const data = [
    { open: 100, high: 105, low: 98, close: 103, index: 0 },
    { open: 103, high: 108, low: 101, close: 106, index: 1 },
    // ...
  ];

  const chart = new ChartLib.Chart(document.getElementById('chart'), {
    data: data,
    mode: 'candles',    // 'candles' | 'area'
  });

  // 新しいローソクを追加して再描画 (最古の 1 本は自動で除去)
  chart.tick({ open: 106, high: 110, low: 104, close: 109 });

  // 1 秒ごとに自動で再描画する例
  const unsubscribe = ChartLib.subscribeRealtimeTick(() => {
    const newCandle = fetchLatestCandle(); // 自前のデータ取得関数
    chart.tick(newCandle);
  });

  // 表示モード切り替え
  chart.setMode('area');

  // 破棄
  unsubscribe();
  chart.destroy();
</script>
```

コンテナ要素は必ずサイズを持つようにしてください
(`width`/`height` を CSS で指定するか、Flex/Grid で引き伸ばす)。
`Chart` はコンテナの `position` が `static` の場合は自動で `relative` にします。

---

## API リファレンス

### `ChartLib.Chart`

レンダラ、`ResizeObserver`、クロスヘアをまとめた高レベルラッパー。

#### コンストラクタ

```js
new ChartLib.Chart(container, options)
```

| 引数 | 型 | 説明 |
|---|---|---|
| `container` | `HTMLElement` | `<canvas>` を挿入する親要素。明示的な寸法が必要 |
| `options.data` | `Array` | OHLC データ配列 (**必須**) — `{ open, high, low, close, index }` |
| `options.mode` | `'candles' \| 'area'` | 初期表示モード (デフォルト `'candles'`) |
| `options.margin` | `{top,right,bottom,left}` | 描画マージン (任意) |
| `options.theme` | `object` | カラーテーマ上書き。`ChartLib.DEFAULT_THEME` 参照 |
| `options.crosshair` | `boolean` | クロスヘア表示 (デフォルト `true`) |

#### インスタンスメソッド

| メソッド | 説明 |
|---|---|
| `tick(newCandle)` | 最古の 1 本を捨てて `newCandle` を追加し、再描画。追加した最新ローソクを返す |
| `setData(data)` | データ全体を差し替えて再描画 |
| `setMode(mode)` | `'candles'` / `'area'` を切り替え |
| `getLastClose()` | 現在の最新終値を返す |
| `destroy()` | Pixi アプリ / Observer / リスナを全て破棄 |

---

### `ChartLib.ChartRenderer` (低レベル)

自前でデータ管理やイベントを書きたい場合に直接使える Pixi レンダラ。

```js
const renderer = new ChartLib.ChartRenderer(canvas, width, height, {
  margin: { top: 10, right: 58, bottom: 22, left: 8 },
  theme:  { background: 0x000000 /* ... */ },
});

const { xScale, yScale } = ChartLib.computeScales(
  data, renderer.innerWidth, renderer.innerHeight
);

renderer.render(
  data, xScale, yScale,
  ChartLib.getYTicks(yScale),
  ChartLib.getXTicks(data.length),
  'candles'
);

// マウスイベントは自分でハンドリング
canvas.addEventListener('mousemove',  e => renderer.updateCrosshair(e.offsetX, e.offsetY));
canvas.addEventListener('mouseleave', () => renderer.hideCrosshair());

renderer.destroy();
```

| メソッド | 説明 |
|---|---|
| `resize(w, h)` | キャンバスと内部サイズを再計算 |
| `render(data, xScale, yScale, yTicks, xTicks, mode)` | 全レイヤを一括描画 |
| `drawGrid` / `drawAxes` / `drawCandles` / `drawArea` / `drawLatestLine` | レイヤ単位の描画 |
| `updateCrosshair(mx, my)` / `hideCrosshair()` | クロスヘア制御 |
| `destroy()` | Pixi リソースを解放 |

内部的に `PIXI.Text` のプール管理をしているため、毎秒再描画してもテクスチャ生成は発生しません。

---

### スケールユーティリティ (純関数)

| 関数 | 返り値 |
|---|---|
| `computeScales(data, innerW, innerH)` | `{ xScale, yScale }` (d3 scaleBand / scaleLinear) |
| `getYTicks(yScale, count = 5)` | Y 軸目盛値の配列 |
| `getXTicks(dataLen, step = 5)` | X 軸目盛インデックスの配列 |

---

### 共有リアルタイムティッカー

複数チャートの再描画タイミングを 1 本の `setInterval` にまとめるためのヘルパー。

```js
const unsub = ChartLib.subscribeRealtimeTick(() => {
  const newCandle = getNewCandle(); // 自前のデータ取得
  chart.tick(newCandle);
}, Math.random() * 900);  // startDelay で描画ジッタを散らす

// 停止
unsub();

// 間隔変更 (デフォルト 1000ms)
ChartLib.setTickInterval(500);
```

購読者がゼロになると `setInterval` 自体がクリアされます。

---

## カスタムテーマ例

```js
new ChartLib.Chart(el, {
  data: myOhlcData,
  theme: {
    background:  0x08121c,
    bullCandle:  0x00e5ff,
    bearCandle:  0xff3366,
    areaLine:    0x00e5ff,
    areaFill:    0x00e5ff,
    latestLine:  0xffffff,
    labelColor:  '#6b8aa0',
  },
});
```

上書きしないキーは `ChartLib.DEFAULT_THEME` の値が使われます。

---

## デモの起動

`chart-lib-demo.html` は純粋な静的 HTML なので、どんな方法でホストしても動きます。

```bash
# 例: Vite 開発サーバ
npm run dev
# → http://localhost:5173/chart-lib-demo.html

# または任意の静的サーバ
npx serve .
```

デモページには 9 種類のインストゥルメント (BTC/USD, ETH/USD, SOL/USD …) が
3×3 グリッドで表示され、各チャートが 1 秒ごとにランダムウォーク OHLC データで
リアルタイム更新されます。

---

## レスポンシブレイアウトとアンチフリッカー

### レスポンシブグリッド

`chart-lib-demo.html` は CSS Grid のメディアクエリで 3 段階に対応します。

| ビューポート幅 | カラム数 | レイアウト |
|---|---|---|
| `< 600px` (スマホ) | 1 列 | スクロール可・カード高さ 200px |
| `600px – 959px` (タブレット) | 2 列 | スクロール可・カード高さ 220px |
| `≥ 960px` (デスクトップ) | 3 列 3 行 | ビューポート全体に 3×3 フィット (スクロールなし) |

### スマホでのチラつき対策

ライブラリ (`chart-lib.js`) と デモ HTML の両側で対策を施しています。

先頭付近のカードだけがチラついて見えやすかった主因は、モバイルブラウザで発生する
`ResizeObserver` のサブピクセル揺れ (例: `320.00px → 319.67px → 320.00px`) により、
実サイズが変わっていないのに canvas リサイズ + 全再描画が連続実行されていたためです。

| 対策 | 場所 | 効果 |
|---|---|---|
| `canvas.style.willChange = 'transform'` | `ChartRenderer` コンストラクタ | GPU コンポジットレイヤーを生成しキャンバスの再ペイントを防止 |
| `.card { transform: translateZ(0); will-change: transform; }` | CSS | カード全体を GPU レイヤーに昇格させ周辺 DOM との合成フラッシュを防止 |
| ResizeObserver を 50 ms デバウンス + `Math.round` + 同一サイズスキップ | `Chart` コンストラクタ | サブピクセル揺れ起因の不要なリサイズ/再描画を止め、スマホでの先頭チャートのチラつきを抑制 |
| `.chart-container { background: var(--card) }` | CSS | キャンバス背景色と一致させ、リサイズ時の一瞬の白/黒フラッシュを不可視化 |
| `overscroll-behavior: none` | `body` | iOS のバウンススクロールによる意図しないリサイズイベントを抑制 |
| ティッカーの起動を 80 ms ずつずらす | デモ JS | 9 チャートの初期描画を分散させ初期ロードスパイクを軽減 |
