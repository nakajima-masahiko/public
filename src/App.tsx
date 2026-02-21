import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { defaultAlerts, initialPortfolio, stockUniverse, type StockRecord } from './data/marketData';

type Tab = '概要' | '財務' | '評価' | 'テクニカル';

const currency = (n: number) => `$${n.toLocaleString()}`;

function App() {
  const [activeTicker, setActiveTicker] = useState('NVDA');
  const [tab, setTab] = useState<Tab>('概要');
  const [frame, setFrame] = useState(59);
  const [simMode, setSimMode] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'MSFT']);
  const [compare, setCompare] = useState<string[]>(['MSFT']);
  const [alerts, setAlerts] = useState(defaultAlerts);
  const [portfolio, setPortfolio] = useState(initialPortfolio);

  const stock = stockUniverse.find((s) => s.ticker === activeTicker) ?? stockUniverse[0];

  const slicedSeries = useMemo(() => stock.prices.slice(0, frame + 1), [stock, frame]);
  const last = slicedSeries[slicedSeries.length - 1];
  const first = slicedSeries[0];

  const compared = stockUniverse.filter((s) => compare.includes(s.ticker));

  useEffect(() => {
    if (!simMode) return;
    const timer = setInterval(() => {
      setFrame((prev) => (prev >= 59 ? 15 : prev + 1));
    }, 900);
    return () => clearInterval(timer);
  }, [simMode]);

  const portfolioValue = portfolio.reduce((acc, p) => {
    const asset = stockUniverse.find((s) => s.ticker === p.ticker);
    const px = asset?.prices[Math.min(frame, asset.prices.length - 1)].close ?? 0;
    return acc + px * p.shares;
  }, 0);

  const toggleWatchlist = (ticker: string) => {
    setWatchlist((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  };

  const toggleCompare = (ticker: string) => {
    setCompare((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker].slice(0, 3)
    );
  };

  return (
    <div className="terminal">
      <aside className="sidebar">
        <div>
          <h1>LUX EQ</h1>
          <p className="muted">Premium Market Terminal</p>
        </div>
        <div className="ticker-list">
          {stockUniverse.map((s) => {
            const px = s.prices[Math.min(frame, s.prices.length - 1)].close;
            return (
              <button
                key={s.ticker}
                className={`ticker-card ${activeTicker === s.ticker ? 'active' : ''}`}
                onClick={() => setActiveTicker(s.ticker)}
              >
                <div>
                  <strong>{s.ticker}</strong>
                  <p>{s.name}</p>
                </div>
                <span>{px.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <section className="topbar glass">
          <div>
            <h2>
              {stock.name} <span className="muted">({stock.ticker})</span>
            </h2>
            <h3>
              {currency(last.close)}
              <span className={last.close - first.open >= 0 ? 'gain' : 'loss'}>
                {' '}
                {(last.close - first.open).toFixed(2)} ({(((last.close - first.open) / first.open) * 100).toFixed(2)}%)
              </span>
            </h3>
          </div>
          <div className="controls">
            <button onClick={() => setSimMode((p) => !p)}>{simMode ? 'シミュ停止' : 'タイムシミュ開始'}</button>
            <input
              type="range"
              min={15}
              max={59}
              value={frame}
              onChange={(e) => setFrame(Number(e.target.value))}
            />
          </div>
        </section>

        <section className="chart-grid">
          <article className="glass chart-panel">
            <header>
              <h4>ローソク足 + インジケーター</h4>
            </header>
            <CandlestickChart data={slicedSeries} />
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={slicedSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['dataMin-10', 'dataMax+10']} />
                <Tooltip />
                <Line dataKey="sma20" stroke="#6ea8fe" dot={false} />
                <Line dataKey="ema50" stroke="#f7b955" dot={false} />
                <Line dataKey="rsi" stroke="#ba68c8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </article>

          <article className="glass chart-panel">
            <header>
              <h4>比較モード</h4>
              <div className="chips">
                {stockUniverse.map((s) => (
                  <button
                    key={s.ticker}
                    className={compare.includes(s.ticker) ? 'chip on' : 'chip'}
                    onClick={() => toggleCompare(s.ticker)}
                  >
                    {s.ticker}
                  </button>
                ))}
              </div>
            </header>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                <XAxis dataKey="time" type="category" allowDuplicatedCategory={false} hide />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip />
                {compared.map((s, i) => (
                  <Area
                    key={s.ticker}
                    data={s.prices.slice(0, frame + 1).map((p) => ({ ...p, normalized: (p.close / s.prices[0].close) * 100 }))}
                    type="monotone"
                    dataKey="normalized"
                    stroke={['#4fc3f7', '#f48fb1', '#81c784'][i]}
                    fillOpacity={0.1}
                    fill={['#4fc3f7', '#f48fb1', '#81c784'][i]}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </article>
        </section>

        <section className="tabs glass">
          {(['概要', '財務', '評価', 'テクニカル'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={t === tab ? 'tab on' : 'tab'}>
              {t}
            </button>
          ))}
          <div className="tab-body">
            {tab === '概要' && <Overview stock={stock} watchlist={watchlist} toggleWatchlist={toggleWatchlist} />}
            {tab === '財務' && <Financials stock={stock} />}
            {tab === '評価' && <Valuation stock={stock} />}
            {tab === 'テクニカル' && <Technical stock={stock} frame={frame} />}
          </div>
        </section>

        <section className="pro-grid">
          <article className="glass pro-card">
            <h4>アラートセンター</h4>
            {alerts.map((a) => (
              <label key={a.id} className="row">
                <input
                  type="checkbox"
                  checked={a.active}
                  onChange={() =>
                    setAlerts((prev) => prev.map((p) => (p.id === a.id ? { ...p, active: !p.active } : p)))
                  }
                />
                {a.ticker}: {a.condition}
              </label>
            ))}
          </article>

          <article className="glass pro-card">
            <h4>Portfolio Sandbox</h4>
            <p>現在評価額: {currency(Number(portfolioValue.toFixed(0)))}</p>
            {portfolio.map((p) => (
              <div key={p.ticker} className="row between">
                <span>{p.ticker}</span>
                <input
                  type="number"
                  value={p.shares}
                  onChange={(e) =>
                    setPortfolio((prev) =>
                      prev.map((x) => (x.ticker === p.ticker ? { ...x, shares: Number(e.target.value) || 0 } : x))
                    )
                  }
                />
              </div>
            ))}
          </article>

          <article className="glass pro-card">
            <h4>決算カレンダー</h4>
            {stockUniverse
              .slice()
              .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate))
              .map((s) => (
                <div key={s.ticker} className="row between">
                  <span>{s.ticker}</span>
                  <span>{s.earningsDate}</span>
                </div>
              ))}
          </article>
        </section>
      </main>
    </div>
  );
}

function CandlestickChart({ data }: { data: StockRecord['prices'] }) {
  const max = Math.max(...data.map((d) => d.high));
  const min = Math.min(...data.map((d) => d.low));
  const range = max - min || 1;
  return (
    <div className="candles">
      {data.map((d) => {
        const top = ((max - d.high) / range) * 220;
        const h = ((d.high - d.low) / range) * 220;
        const bodyTop = ((max - Math.max(d.open, d.close)) / range) * 220;
        const bodyH = (Math.abs(d.open - d.close) / range) * 220 + 3;
        return (
          <div className="candle" key={d.time}>
            <span className="wick" style={{ top, height: h }} />
            <span
              className={d.close >= d.open ? 'body up' : 'body down'}
              style={{ top: bodyTop, height: bodyH }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Overview({
  stock,
  watchlist,
  toggleWatchlist,
}: {
  stock: StockRecord;
  watchlist: string[];
  toggleWatchlist: (ticker: string) => void;
}) {
  return (
    <div className="grid-two">
      <div>
        <p>{stock.summary}</p>
        <p>
          Sector: {stock.sector} / Market Cap: {stock.marketCap}
        </p>
      </div>
      <div>
        <button onClick={() => toggleWatchlist(stock.ticker)}>
          {watchlist.includes(stock.ticker) ? 'ウォッチリスト解除' : 'ウォッチリスト追加'}
        </button>
        <p>Watchlist: {watchlist.join(', ')}</p>
      </div>
    </div>
  );
}

function Financials({ stock }: { stock: StockRecord }) {
  return (
    <div className="table">
      {stock.financials.map((f) => (
        <div key={f.period} className="row between">
          <strong>{f.period}</strong>
          <span>Revenue {currency(f.revenue)}M</span>
          <span>EBITDA {currency(f.ebitda)}M</span>
          <span>FCF {currency(f.fcf)}M</span>
        </div>
      ))}
    </div>
  );
}

function Valuation({ stock }: { stock: StockRecord }) {
  return (
    <div className="grid-two">
      <div>
        <p>P/E: {stock.pe}</p>
        <p>Beta: {stock.beta}</p>
        <p>Dividend: {stock.dividendYield}%</p>
      </div>
      <div>
        {stock.valuation.map((v) => (
          <div key={v.metric} className="row between">
            <span>{v.metric}</span>
            <strong>{v.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Technical({ stock, frame }: { stock: StockRecord; frame: number }) {
  const sample = stock.prices[Math.min(frame, stock.prices.length - 1)];
  return (
    <div className="grid-two">
      <div>
        <p>RSI: {sample.rsi}</p>
        <p>SMA20: {sample.sma20}</p>
        <p>EMA50: {sample.ema50}</p>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={stock.futureTargets}>
          <CartesianGrid strokeDasharray="2 2" stroke="#2c3b52" />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip />
          <Line dataKey="bull" stroke="#81c784" />
          <Line dataKey="base" stroke="#90caf9" />
          <Line dataKey="bear" stroke="#ef9a9a" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default App;
