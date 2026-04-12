# chart-lib

`realtime-chart-dashboard.html` のチャート描画処理を抜き出した、
PixiJS + d3 ベースのリアルタイム OHLC チャート描画ライブラリです。

- **低レベル API** (`ChartRenderer`): キャンバスに直接描画する Pixi レンダラ
- **高レベル API** (`Chart`): データ生成 / リサイズ / クロスヘアまで面倒を見る薄いラッパー
- **ユーティリティ**: ランダムウォーク OHLC 生成、d3 スケール計算、共有ティッカー

ビルドステップは不要で、既存の静的 HTML にそのまま `<script>` で差し込めます。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `chart-lib.js` | ライブラリ本体 (`window.ChartLib` を公開) |
| `chart-lib-demo.html` | 最小構成のデモページ (単一チャート + モード切り替え) |
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
  const chart = new ChartLib.Chart(document.getElementById('chart'), {
    basePrice:  65000,
    volatility: 450,
    count:      30,           // スライディングウィンドウの長さ
    mode:       'candles',    // 'candles' | 'area'
  });

  // 1 秒ごとに新しいローソクを追加して再描画
  const unsubscribe = ChartLib.subscribeRealtimeTick(() => chart.tick());

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

データ生成、レンダラ、`ResizeObserver`、クロスヘアをまとめた高レベルラッパー。

#### コンストラクタ

```js
new ChartLib.Chart(container, options)
```

| 引数 | 型 | 説明 |
|---|---|---|
| `container` | `HTMLElement` | `<canvas>` を挿入する親要素。明示的な寸法が必要 |
| `options.basePrice` | `number` | 初期価格 (デフォルト `100`) |
| `options.volatility` | `number` | 1 ティックあたりの値動き幅 (デフォルト `1`) |
| `options.count` | `number` | スライディングウィンドウに保持する本数 (デフォルト `25`) |
| `options.mode` | `'candles' \| 'area'` | 初期表示モード (デフォルト `'candles'`) |
| `options.margin` | `{top,right,bottom,left}` | 描画マージン (任意) |
| `options.theme` | `object` | カラーテーマ上書き。`ChartLib.DEFAULT_THEME` 参照 |
| `options.initialData` | `Array` | ランダムウォークの代わりに使う初期データ |
| `options.crosshair` | `boolean` | クロスヘア表示 (デフォルト `true`) |

#### インスタンスメソッド

| メソッド | 説明 |
|---|---|
| `tick()` | 最古の 1 本を捨てて新しい 1 本を追加し、再描画。追加した最新ローソクを返す |
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

### データユーティリティ

| 関数 | 説明 |
|---|---|
| `generateOHLC(prevClose, volatility)` | `prevClose` からランダムウォークで 1 本の OHLC を生成 |
| `generateInitialData(basePrice, volatility, count)` | 初期データ配列を生成 |
| `appendNewCandle(data, volatility)` | 最古の 1 本を捨てて最新 1 本を末尾に追加 (非破壊) |

配列の要素は `{ open, high, low, close, index }` です。

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
  chart.tick();
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
  basePrice: 100, volatility: 1.2,
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

## `realtime-chart-dashboard.html` からの移行メモ

元ファイルに直書きされていた以下のシンボルは、そのまま `ChartLib.*` から取得できます。

| 元の場所 | 置換先 |
|---|---|
| `generateOHLC` / `generateInitialData` / `appendNewCandle` | `ChartLib.generateOHLC` 他 |
| `computeScales` / `getYTicks` / `getXTicks` | `ChartLib.computeScales` 他 |
| `class ChartRenderer` | `ChartLib.ChartRenderer` |
| `subscribeRealtimeTick` | `ChartLib.subscribeRealtimeTick` |

`ChartRenderer` のコンストラクタは `(canvas, width, height, options?)` と
第 4 引数に `margin` / `theme` を取るようになりましたが、省略時の挙動は
元ファイルと完全に同じです。React コンポーネント側のコードは変更不要で、
`new ChartRenderer(canvas, w, h)` をそのまま動かせます。

---

## デモの起動

このリポジトリは Vite プロジェクトですが、`chart-lib-demo.html` は
純粋な静的 HTML なので、どんな方法でホストしても動きます。

```bash
# 例: Vite 開発サーバ
npm run dev
# → http://localhost:5173/chart-lib-demo.html

# または任意の静的サーバ
npx serve .
```
