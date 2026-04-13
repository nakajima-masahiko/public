/* ═══════════════════════════════════════════════════════════════════
   chart-lib-debug.js — chart-lib.js の診断版
   オリジナルと同機能 + 詳細ログをメモリに記録。

   追加 API:
     ChartLib.downloadDebugLogs()  — ログをテキストファイルとしてDL
     ChartLib.getDebugLogs()       — ログ配列を返す (読み取り専用コピー)
     ChartLib.clearDebugLogs()     — ログをリセット

   ログに記録する主なイベント:
     [ENV]      ページロード時の環境情報
     [NEW]      Chart コンストラクタ開始・getBoundingClientRect の値
     [RAF]      RAF コールバック内の再計測値・差分の有無
     [RESIZE]   renderer.resize() の発動
     [RO-FIRE]  ResizeObserver コールバックの着火
     [RO-ACT]   デバウンス後に実際にリサイズ処理を実行
     [TICKER]   PixiJS Ticker の最初の描画フレーム

   使い方:
     通常の chart-lib.js の代わりにこのファイルを読み込む。
     画面の「ログDL」ボタンを押すとテキストファイルをダウンロード。
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  if (typeof global.d3 === 'undefined') {
    console.warn('[chart-lib-debug] d3 is not loaded.');
  }
  if (typeof global.PIXI === 'undefined') {
    console.warn('[chart-lib-debug] PixiJS is not loaded.');
  }

  /* ─────────────────────────────────────────────────────────────────
     DEBUG LOG BUFFER
  ───────────────────────────────────────────────────────────────── */

  const _logs = [];
  const _MAX_LOGS = 1000;
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;

  function _log(tag, msg) {
    const elapsed = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - _t0).toFixed(2);
    const entry = `[${String(elapsed).padStart(9)}ms] [${tag}] ${msg}`;
    _logs.push(entry);
    if (_logs.length > _MAX_LOGS) _logs.shift();
    // コンソールにも流す（デスクトップでのリアルタイム確認用）
    console.log('%c[chart-debug]', 'color:#38bdf8', entry);
  }

  function downloadDebugLogs() {
    const header = [
      '=== chart-lib-debug log ===',
      `Date      : ${new Date().toISOString()}`,
      `UserAgent : ${navigator.userAgent}`,
      `dPR       : ${window.devicePixelRatio}`,
      `innerSize : ${window.innerWidth}x${window.innerHeight}`,
      `screenSize: ${screen.width}x${screen.height}`,
      `orientation: ${(screen.orientation && screen.orientation.type) || 'unknown'}`,
      '===========================',
      '',
    ].join('\n');
    const text = header + _logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `chart-debug-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getDebugLogs()  { return _logs.slice(); }
  function clearDebugLogs() { _logs.length = 0; _log('RESET', 'log cleared'); }

  // 初期環境を記録（DOMContentLoaded 後に確実にサイズが取れる）
  function _logEnv() {
    _log('ENV', `dPR=${window.devicePixelRatio} inner=${window.innerWidth}x${window.innerHeight} screen=${screen.width}x${screen.height} orientation=${(screen.orientation && screen.orientation.type) || 'n/a'}`);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _logEnv);
  } else {
    _logEnv();
  }

  /* ─────────────────────────────────────────────────────────────────
     SCALE UTILITIES
  ───────────────────────────────────────────────────────────────── */

  function computeScales(data, innerW, innerH) {
    const xScale = d3.scaleBand()
      .domain(data.map((_, i) => i))
      .range([0, innerW])
      .padding(0.2);

    let yMin = d3.min(data, d => d.low);
    let yMax = d3.max(data, d => d.high);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.12;

    const yScale = d3.scaleLinear()
      .domain([yMin - pad, yMax + pad])
      .range([innerH, 0]);

    return { xScale, yScale };
  }

  function getYTicks(yScale, count = 5) { return yScale.ticks(count); }

  function getXTicks(dataLen, step = 5) {
    const t = [];
    for (let i = 0; i < dataLen; i += step) t.push(i);
    return t;
  }

  /* ─────────────────────────────────────────────────────────────────
     DEFAULT THEME
  ───────────────────────────────────────────────────────────────── */

  const DEFAULT_THEME = {
    background:    0x1a1d27,
    grid:          0x1e2235,
    axis:          0x2a2d3a,
    bullCandle:    0x26a69a,
    bearCandle:    0xef5350,
    areaLine:      0x38bdf8,
    areaFill:      0x38bdf8,
    latestLine:    0x38bdf8,
    crosshair:     0x5a9fd4,
    labelColor:    '#5a6a80',
    labelFontSize: 9,
    labelFontFamily: 'monospace',
  };

  /* ─────────────────────────────────────────────────────────────────
     CHART RENDERER
  ───────────────────────────────────────────────────────────────── */

  class ChartRenderer {
    constructor(canvas, width, height, options = {}) {
      this.margin = Object.assign(
        { top: 10, right: 58, bottom: 22, left: 8 },
        options.margin || {},
      );
      this.theme  = Object.assign({}, DEFAULT_THEME, options.theme || {});
      this._debugName = options._debugName || '?';

      this.width  = width;
      this.height = height;
      this._iw = width  - this.margin.left - this.margin.right;
      this._ih = height - this.margin.top  - this.margin.bottom;

      this.app = new PIXI.Application({
        view:            canvas,
        width,
        height,
        backgroundColor: this.theme.background,
        antialias:       true,
        // Event-driven rendering: avoid continuous RAF loop.
        // This removes startup flicker seen on mobile when many charts
        // initialize together in the first viewport.
        sharedTicker:    false,
        autoStart:       false,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
        // Event-driven rendering (no continuous RAF) requires preserving
        // the drawing buffer; otherwise some Android GPUs/compositors can
        // drop the previous frame and show an opaque black canvas until the
        // next explicit render (seen as a 1-second blink cadence).
        preserveDrawingBuffer: true,
        // Avoid a transient clear-to-background flash on some mobile GPUs
        // when Pixi internally performs an unexpected render pass.
        clearBeforeRender: true,
      });
      this.app.stop();
      // Belt-and-suspenders: keep Pixi's internal ticker fully stopped.
      // On some Android Chrome builds, an internal first tick can still occur
      // and briefly flash charts in the initial viewport.
      this.app.ticker.autoStart = false;
      this.app.ticker.stop();

      canvas.style.width       = width  + 'px';
      canvas.style.height      = height + 'px';

      this.ctr = new PIXI.Container();
      this.ctr.x = this.margin.left;
      this.ctr.y = this.margin.top;
      this.app.stage.addChild(this.ctr);

      this.gGrid      = new PIXI.Graphics();
      this.gAreaFill  = new PIXI.Graphics();
      this.gAreaLine  = new PIXI.Graphics();
      this.gCandle    = new PIXI.Graphics();
      this.gLatest    = new PIXI.Graphics();
      this.gAxis      = new PIXI.Graphics();
      this.gCrosshair = new PIXI.Graphics();

      for (const g of [
        this.gGrid, this.gAreaFill, this.gAreaLine,
        this.gCandle, this.gLatest, this.gAxis, this.gCrosshair,
      ]) this.ctr.addChild(g);

      this.labelCtr = new PIXI.Container();
      this.app.stage.addChild(this.labelCtr);
      this._pool   = [];
      this._active = [];

      this._labelStyle = new PIXI.TextStyle({
        fontSize:   this.theme.labelFontSize,
        fill:       this.theme.labelColor,
        fontFamily: this.theme.labelFontFamily,
      });
    }

    get innerWidth()  { return this._iw; }
    get innerHeight() { return this._ih; }

    resize(w, h) {
      // ★ LOG: resize 発動を記録
      _log('RESIZE', `[${this._debugName}] ${this.width}x${this.height} → ${w}x${h}`);

      this.width  = w; this.height = h;
      this._iw = w - this.margin.left - this.margin.right;
      this._ih = h - this.margin.top  - this.margin.bottom;
      this.app.renderer.resize(w, h);
      const cv = this.app.view;
      cv.style.width  = w + 'px';
      cv.style.height = h + 'px';
    }

    _get(text) {
      let t;
      if (this._pool.length) {
        t = this._pool.pop();
        t.text    = text;
        t.visible = true;
      } else {
        t = new PIXI.Text(text, this._labelStyle);
        this.labelCtr.addChild(t);
      }
      this._active.push(t);
      return t;
    }

    _releaseLabels() {
      for (const t of this._active) { t.visible = false; this._pool.push(t); }
      this._active = [];
    }

    drawGrid(xTicks, yTicks, xScale, yScale) {
      const g = this.gGrid;
      g.clear();
      const W = this._iw, H = this._ih;
      g.lineStyle(1, this.theme.grid, 1);
      for (const v of yTicks) {
        const y = yScale(v);
        g.moveTo(0, y); g.lineTo(W, y);
      }
      for (const i of xTicks) {
        const x = xScale(i) + xScale.bandwidth() / 2;
        g.moveTo(x, 0); g.lineTo(x, H);
      }
    }

    drawCandles(data, xScale, yScale) {
      const g  = this.gCandle;
      g.clear();
      const bw = Math.max(xScale.bandwidth(), 1);

      for (let i = 0; i < data.length; i++) {
        const d     = data[i];
        const x     = xScale(i);
        const cx    = x + bw / 2;
        const bull  = d.close >= d.open;
        const color = bull ? this.theme.bullCandle : this.theme.bearCandle;

        const bTop = yScale(Math.max(d.open, d.close));
        const bBot = yScale(Math.min(d.open, d.close));
        const bH   = Math.max(bBot - bTop, 1);

        g.lineStyle(1, color, 1);
        g.beginFill(color, 1);
        g.drawRect(x, bTop, bw, bH);
        g.endFill();

        g.moveTo(cx, yScale(d.high)); g.lineTo(cx, bTop);
        g.moveTo(cx, bBot);           g.lineTo(cx, yScale(d.low));
      }
    }

    drawArea(data, xScale, yScale) {
      const H = this._ih;
      if (data.length < 2) return;

      const pts = [];
      for (let i = 0; i < data.length; i++) {
        pts.push(xScale(i) + xScale.bandwidth() / 2, yScale(data[i].close));
      }
      pts.push(
        xScale(data.length - 1) + xScale.bandwidth() / 2, H,
        xScale(0)               + xScale.bandwidth() / 2, H,
      );

      const fill = this.gAreaFill;
      fill.clear();
      fill.beginFill(this.theme.areaFill, 0.18);
      fill.drawPolygon(pts);
      fill.endFill();

      const midPts = [];
      for (let i = 0; i < data.length; i++) {
        const x = xScale(i) + xScale.bandwidth() / 2;
        const y = yScale(data[i].close);
        midPts.push(x, y + (H - y) * 0.5);
      }
      const upperHalf = [];
      for (let i = 0; i < data.length; i++) {
        upperHalf.push(xScale(i) + xScale.bandwidth() / 2, yScale(data[i].close));
      }
      for (let i = data.length - 1; i >= 0; i--) {
        upperHalf.push(midPts[i * 2], midPts[i * 2 + 1]);
      }
      fill.beginFill(this.theme.areaFill, 0.07);
      fill.drawPolygon(upperHalf);
      fill.endFill();

      const line = this.gAreaLine;
      line.clear();
      line.lineStyle(2, this.theme.areaLine, 1);
      line.moveTo(xScale(0) + xScale.bandwidth() / 2, yScale(data[0].close));
      for (let i = 1; i < data.length; i++) {
        line.lineTo(xScale(i) + xScale.bandwidth() / 2, yScale(data[i].close));
      }
    }

    drawAxes(yTicks, yScale) {
      const g = this.gAxis;
      g.clear();
      const W = this._iw, H = this._ih;

      g.lineStyle(1, this.theme.axis, 1);
      g.moveTo(0, 0); g.lineTo(0, H);
      g.moveTo(0, H); g.lineTo(W, H);

      this._releaseLabels();

      for (const v of yTicks) {
        const lbl = this._get(v.toFixed(2));
        lbl.x = this.margin.left + W + 3;
        lbl.y = this.margin.top  + yScale(v) - 5;
      }
    }

    drawLatestLine(lastClose, yScale) {
      const g = this.gLatest;
      g.clear();
      const y = yScale(lastClose);
      const W = this._iw;
      g.lineStyle(1, this.theme.latestLine, 0.45);
      for (let x = 0; x < W; x += 8) {
        g.moveTo(x, y); g.lineTo(Math.min(x + 4, W), y);
      }
    }

    updateCrosshair(mouseX, mouseY) {
      const g  = this.gCrosshair;
      g.clear();
      const ix = mouseX - this.margin.left;
      const iy = mouseY - this.margin.top;
      const W  = this._iw, H = this._ih;
      if (ix < 0 || ix > W || iy < 0 || iy > H) return;
      g.lineStyle(1, this.theme.crosshair, 0.65);
      g.moveTo(ix, 0); g.lineTo(ix, H);
      g.moveTo(0, iy); g.lineTo(W, iy);
    }

    hideCrosshair() { this.gCrosshair.clear(); }

    present() {
      this.app.renderer.render(this.app.stage);
    }

    render(data, xScale, yScale, yTicks, xTicks, mode) {
      this.drawGrid(xTicks, yTicks, xScale, yScale);
      this.drawAxes(yTicks, yScale);
      this.drawLatestLine(data[data.length - 1].close, yScale);

      if (mode === 'candles') {
        this.gAreaFill.clear();
        this.gAreaLine.clear();
        this.drawCandles(data, xScale, yScale);
      } else {
        this.gCandle.clear();
        this.drawArea(data, xScale, yScale);
      }
    }

    destroy() {
      this._releaseLabels();
      this.app.destroy(false, { children: true, texture: true });
    }
  }

  /* ─────────────────────────────────────────────────────────────────
     HIGH-LEVEL CHART WRAPPER
  ───────────────────────────────────────────────────────────────── */

  class Chart {
    constructor(container, opts = {}) {
      if (!container) throw new Error('[chart-lib-debug] Chart requires a container element.');
      if (!opts.data || !opts.data.length) throw new Error('[chart-lib-debug] Chart requires opts.data.');

      // ★ チャートごとの識別子（opts._debugName があれば優先）
      this._debugName = opts._debugName || `chart-${Chart._seq}`;
      Chart._seq++;

      this.container  = container;
      this.mode       = opts.mode   ?? 'candles';
      this.margin     = opts.margin;
      this.theme      = opts.theme;
      this.data       = opts.data.slice();

      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.top  = '0';
      this.canvas.style.left = '0';
      this.canvas.style.display = 'block';

      const cs = getComputedStyle(container);
      if (cs.position === 'static') container.style.position = 'relative';
      container.appendChild(this.canvas);

      // ★ LOG: コンストラクタ時の getBoundingClientRect
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width,  40);
      const h = Math.max(rect.height, 40);
      _log('NEW', `[${this._debugName}] BCR at construct: raw=${rect.width.toFixed(2)}x${rect.height.toFixed(2)} → used=${w.toFixed(2)}x${h.toFixed(2)}`);

      this.renderer = new ChartRenderer(this.canvas, w, h, {
        margin:     this.margin,
        theme:      this.theme,
        _debugName: this._debugName,
      });

      this._draw();
      this.renderer.present();

      this._lastResizeW = Math.round(w);
      this._lastResizeH = Math.round(h);

      _log('PRESENT', `[${this._debugName}] first synchronous present done`);

      // ResizeObserver（デバウンス + サブピクセルスキップ）
      this._ro = new ResizeObserver(entries => {
        let lw = 0, lh = 0;
        for (const e of entries) { lw = e.contentRect.width; lh = e.contentRect.height; }

        // ★ LOG: RO 着火
        _log('RO-FIRE', `[${this._debugName}] contentRect=${lw.toFixed(2)}x${lh.toFixed(2)}`);

        clearTimeout(this._roTimer);
        this._roTimer = setTimeout(() => {
          const rw = Math.round(lw);
          const rh = Math.round(lh);
          if (rw < 10 || rh < 10) {
            _log('RO-ACT', `[${this._debugName}] SKIP (too small: ${rw}x${rh})`);
            return;
          }
          if (rw === this._lastResizeW && rh === this._lastResizeH) {
            _log('RO-ACT', `[${this._debugName}] SKIP (no change: ${rw}x${rh})`);
            return;
          }
          // ★ LOG: RO が実際にリサイズを実行
          _log('RO-ACT', `[${this._debugName}] EXECUTE resize ${this._lastResizeW}x${this._lastResizeH} → ${rw}x${rh}`);
          this._lastResizeW = rw;
          this._lastResizeH = rh;
          this.renderer.resize(rw, rh);
          this._draw();
        }, 50);
      });

      // RAF 遅延で observe() を開始 + 初期サイズ再計測
      this._initRafId = requestAnimationFrame(() => {
        this._initRafId = null;
        const r2 = this.container.getBoundingClientRect();
        const rw = Math.round(Math.max(r2.width,  40));
        const rh = Math.round(Math.max(r2.height, 40));

        // ★ LOG: RAF 時点の再計測
        const diff = rw !== this._lastResizeW || rh !== this._lastResizeH;
        _log('RAF', `[${this._debugName}] BCR at RAF: raw=${r2.width.toFixed(2)}x${r2.height.toFixed(2)} → ${rw}x${rh}  prev=${this._lastResizeW}x${this._lastResizeH}  diff=${diff}`);

        if (diff) {
          // ★ LOG: RAF からリサイズ実行
          _log('RAF', `[${this._debugName}] ⚠ RESIZE TRIGGERED from RAF`);
          this._lastResizeW = rw;
          this._lastResizeH = rh;
          this.renderer.resize(rw, rh);
          this._draw();
        }
        this._ro.observe(this.container);
        _log('RAF', `[${this._debugName}] RO.observe() called`);
      });

      // Crosshair
      if (opts.crosshair !== false) {
        this._onMove  = e => {
          this.renderer.updateCrosshair(e.offsetX, e.offsetY);
          this.renderer.present();
        };
        this._onLeave = () => {
          this.renderer.hideCrosshair();
          this.renderer.present();
        };
        this.canvas.addEventListener('mousemove',  this._onMove);
        this.canvas.addEventListener('mouseleave', this._onLeave);
      }
    }

    _draw() {
      const { xScale, yScale } = computeScales(
        this.data,
        this.renderer.innerWidth,
        this.renderer.innerHeight,
      );
      this.renderer.render(
        this.data, xScale, yScale,
        getYTicks(yScale), getXTicks(this.data.length),
        this.mode,
      );
      this.renderer.present();
    }

    tick(newCandle) {
      const last = this.data[this.data.length - 1];
      this.data = [...this.data.slice(1), { ...newCandle, index: last.index + 1 }];
      this._draw();
      return this.data[this.data.length - 1];
    }

    setData(data) {
      this.data = data.slice();
      this._draw();
    }

    setMode(mode) {
      this.mode = mode;
      this._draw();
    }

    getLastClose() {
      return this.data[this.data.length - 1]?.close ?? null;
    }

    destroy() {
      cancelAnimationFrame(this._initRafId);
      clearTimeout(this._roTimer);
      this._ro?.disconnect();
      if (this._onMove)  this.canvas.removeEventListener('mousemove',  this._onMove);
      if (this._onLeave) this.canvas.removeEventListener('mouseleave', this._onLeave);
      this.renderer.destroy();
      this.canvas.remove();
    }
  }

  Chart._seq = 0;  // チャート連番（静的カウンタ）

  /* ─────────────────────────────────────────────────────────────────
     SHARED REALTIME TICKER
  ───────────────────────────────────────────────────────────────── */

  const realtimeSubscribers = new Set();
  let realtimeIntervalId = null;
  let tickIntervalMs = 1000;

  function ensureRealtimeTicker() {
    if (realtimeIntervalId != null) return;
    realtimeIntervalId = setInterval(() => {
      realtimeSubscribers.forEach(fn => fn());
    }, tickIntervalMs);
  }

  function subscribeRealtimeTick(fn, startDelay = 0) {
    let active = true;
    const timeoutId = setTimeout(() => {
      if (!active) return;
      realtimeSubscribers.add(fn);
      ensureRealtimeTicker();
    }, startDelay);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      realtimeSubscribers.delete(fn);
      if (realtimeSubscribers.size === 0 && realtimeIntervalId != null) {
        clearInterval(realtimeIntervalId);
        realtimeIntervalId = null;
      }
    };
  }

  function setTickInterval(ms) {
    tickIntervalMs = ms;
    if (realtimeIntervalId != null) {
      clearInterval(realtimeIntervalId);
      realtimeIntervalId = null;
      ensureRealtimeTicker();
    }
  }

  /* ─────────────────────────────────────────────────────────────────
     EXPORT
  ───────────────────────────────────────────────────────────────── */

  global.ChartLib = {
    computeScales,
    getYTicks,
    getXTicks,
    ChartRenderer,
    Chart,
    DEFAULT_THEME,
    subscribeRealtimeTick,
    setTickInterval,
    // ── 診断 API ──
    downloadDebugLogs,
    getDebugLogs,
    clearDebugLogs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
