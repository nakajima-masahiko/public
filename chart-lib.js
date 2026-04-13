/* ═══════════════════════════════════════════════════════════════════
   chart-lib.js — Realtime OHLC chart rendering library (PixiJS + d3)

   Exposes a global `ChartLib` namespace with:
     • Scale utilities ....... computeScales / getYTicks / getXTicks
     • ChartRenderer ......... low-level PixiJS renderer
     • Chart ................. high-level convenience wrapper that
                               composes data + renderer + resize
     • subscribeRealtimeTick . shared 1-second ticker (optional)

   Peer dependencies (must be loaded BEFORE this script):
     • d3      v7 — pure scale math, no DOM usage
     • PixiJS  v7 — all canvas rendering

   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  if (typeof global.d3 === 'undefined') {
    console.warn('[chart-lib] d3 is not loaded — ChartLib requires d3 v7.');
  }
  if (typeof global.PIXI === 'undefined') {
    console.warn('[chart-lib] PixiJS is not loaded — ChartLib requires PixiJS v7.');
  }

  /* ─────────────────────────────────────────────────────────────────
     SCALE UTILITIES  (pure math — no DOM/SVG)
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

  function getYTicks(yScale, count = 5) {
    return yScale.ticks(count);
  }

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
     CHART RENDERER — all PixiJS drawing lives here
  ───────────────────────────────────────────────────────────────── */

  class ChartRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @param {object} [options]
     * @param {object} [options.margin]  { top, right, bottom, left }
     * @param {object} [options.theme]   overrides for DEFAULT_THEME
     */
    constructor(canvas, width, height, options = {}) {
      this.margin = Object.assign(
        { top: 10, right: 58, bottom: 22, left: 8 },
        options.margin || {},
      );
      this.theme  = Object.assign({}, DEFAULT_THEME, options.theme || {});

      this.width  = width;
      this.height = height;
      this._iw = width  - this.margin.left - this.margin.right;
      this._ih = height - this.margin.top  - this.margin.bottom;

      // PixiJS Application — attach to caller-supplied canvas
      this.app = new PIXI.Application({
        view:            canvas,
        width,
        height,
        backgroundColor: this.theme.background,
        antialias:       true,
        // This chart is event-driven (draw only when data/size/pointer changes),
        // so a continuous RAF render loop is unnecessary and can cause mobile
        // startup flicker with multiple in-viewport canvases.
        sharedTicker:    false,
        autoStart:       false,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
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

      // Container offset by margins — inner-space origin at (0,0)
      this.ctr = new PIXI.Container();
      this.ctr.x = this.margin.left;
      this.ctr.y = this.margin.top;
      this.app.stage.addChild(this.ctr);

      // Graphics layers in z-order (back → front)
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

      // Label pool — PIXI.Text objects reused to avoid texture churn
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
      this.width  = w; this.height = h;
      this._iw = w - this.margin.left - this.margin.right;
      this._ih = h - this.margin.top  - this.margin.bottom;
      this.app.renderer.resize(w, h);
      const cv = this.app.view;
      cv.style.width  = w + 'px';
      cv.style.height = h + 'px';
    }

    /* Text-label pool helpers */
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

      // Lighter inner layer — upper half band
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

    /**
     * Master render.
     * @param {Array} data   OHLC candles
     * @param {*}    xScale  d3 band scale
     * @param {*}    yScale  d3 linear scale
     * @param {Array} yTicks
     * @param {Array} xTicks
     * @param {'candles'|'area'} mode
     */
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
     Composes data + renderer + ResizeObserver + crosshair handling.
  ───────────────────────────────────────────────────────────────── */

  /**
   * @param {HTMLElement} container  wrapper element — a <canvas> will be
   *                                 appended to it; container should have
   *                                 an explicit size (or flex into one).
   * @param {object}  opts
   * @param {Array}   opts.data                OHLC data array (required)
   * @param {'candles'|'area'} [opts.mode='candles']
   * @param {object} [opts.margin]
   * @param {object} [opts.theme]
   * @param {boolean}[opts.crosshair=true]
   */
  class Chart {
    constructor(container, opts = {}) {
      if (!container) throw new Error('[chart-lib] Chart requires a container element.');
      if (!opts.data || !opts.data.length) throw new Error('[chart-lib] Chart requires opts.data (OHLC array).');

      this.container  = container;
      this.mode       = opts.mode   ?? 'candles';
      this.margin     = opts.margin;
      this.theme      = opts.theme;

      this.data = opts.data.slice();

      // Build canvas inside container
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.top  = '0';
      this.canvas.style.left = '0';
      this.canvas.style.display = 'block';

      const cs = getComputedStyle(container);
      if (cs.position === 'static') container.style.position = 'relative';
      container.appendChild(this.canvas);

      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width,  40);
      const h = Math.max(rect.height, 40);

      this.renderer = new ChartRenderer(this.canvas, w, h, {
        margin: this.margin,
        theme:  this.theme,
      });

      this._draw();
      // Force a synchronous render immediately after drawing so the canvas is
      // fully painted before the browser's first composite frame.  Without this,
      // PixiJS's opaque-black WebGL surface is visible until the first Ticker
      // tick (~700 ms on mid-range mobile), causing a visible flash on charts
      // that are in the initial viewport (typically the first 2 on mobile).
      this.renderer.app.renderer.render(this.renderer.app.stage);

      // Resize observer (mobile anti-flicker):
      // - debounce rapid bursts
      // - ignore sub-pixel jitter (fractional size noise on mobile browsers)
      // - skip no-op resize when rounded size is unchanged
      this._lastResizeW = Math.round(w);
      this._lastResizeH = Math.round(h);
      this._ro = new ResizeObserver(entries => {
        let lw = 0, lh = 0;
        for (const e of entries) { lw = e.contentRect.width; lh = e.contentRect.height; }
        clearTimeout(this._roTimer);
        this._roTimer = setTimeout(() => {
          const rw = Math.round(lw);
          const rh = Math.round(lh);
          if (rw < 10 || rh < 10) return;
          if (rw === this._lastResizeW && rh === this._lastResizeH) return;
          this._lastResizeW = rw;
          this._lastResizeH = rh;
          this.renderer.resize(rw, rh);
          this._draw();
        }, 50);
      });

      // Defer observe() to after the first animation frame so that all charts
      // finish being appended to the DOM (the forEach loop is synchronous) and
      // the browser completes its initial layout before we start watching.
      // Without this, the ResizeObserver's first notification arrives with the
      // fully-settled size, which can differ from the size measured above for
      // the earliest-created charts (the first 2 on mobile), triggering a
      // spurious resize+redraw that causes a visible flicker.
      this._initRafId = requestAnimationFrame(() => {
        this._initRafId = null;
        // Re-measure in case layout settled to a different size than at
        // construction time (e.g. scrollbar appearance, URL-bar animation).
        const r2 = this.container.getBoundingClientRect();
        const rw = Math.round(Math.max(r2.width,  40));
        const rh = Math.round(Math.max(r2.height, 40));
        if (rw !== this._lastResizeW || rh !== this._lastResizeH) {
          this._lastResizeW = rw;
          this._lastResizeH = rh;
          this.renderer.resize(rw, rh);
          this._draw();
        }
        this._ro.observe(this.container);
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

    /**
     * Drop the oldest candle, append `newCandle`, and redraw.
     * @param {{ open:number, high:number, low:number, close:number }} newCandle
     * @returns {object} the appended candle (with `index`)
     */
    tick(newCandle) {
      const last = this.data[this.data.length - 1];
      this.data = [...this.data.slice(1), { ...newCandle, index: last.index + 1 }];
      this._draw();
      return this.data[this.data.length - 1];
    }

    /** Replace the sliding-window data entirely + redraw. */
    setData(data) {
      this.data = data.slice();
      this._draw();
    }

    /** Switch between 'candles' and 'area'. */
    setMode(mode) {
      this.mode = mode;
      this._draw();
    }

    /** Current last close. */
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

  /* ─────────────────────────────────────────────────────────────────
     SHARED REALTIME TICKER (optional helper)
     Single interval drives any number of subscribers — keeps the
     wall clock aligned across charts.
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

  /**
   * Subscribe a callback to the shared ticker.
   * @param {() => void} fn
   * @param {number}     [startDelay=0]   stagger so charts don't all tick
   *                                      on the same frame
   * @returns {() => void} unsubscribe
   */
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

  /** Change the shared ticker interval (ms). Affects next scheduled tick. */
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
    // scales
    computeScales,
    getYTicks,
    getXTicks,
    // rendering
    ChartRenderer,
    Chart,
    DEFAULT_THEME,
    // realtime
    subscribeRealtimeTick,
    setTickInterval,
  };
})(typeof window !== 'undefined' ? window : globalThis);
