export type PricePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number;
  ema50: number;
  rsi: number;
};

export type StockRecord = {
  ticker: string;
  name: string;
  sector: string;
  marketCap: string;
  pe: number;
  beta: number;
  dividendYield: number;
  earningsDate: string;
  summary: string;
  valuation: { metric: string; value: string }[];
  financials: { period: string; revenue: number; ebitda: number; fcf: number }[];
  futureTargets: { year: number; bull: number; base: number; bear: number }[];
  prices: PricePoint[];
};

const makeSeries = (base: number, volatility: number): PricePoint[] => {
  const arr: PricePoint[] = [];
  let prev = base;
  for (let i = 0; i < 60; i++) {
    const trend = Math.sin(i / 8) * 1.2;
    const drift = (Math.random() - 0.45) * volatility + trend;
    const open = prev;
    const close = Math.max(10, open + drift);
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const sma20 = close - Math.sin(i / 5) * 2;
    const ema50 = close - Math.cos(i / 7) * 2.4;
    const rsi = 40 + Math.sin(i / 6) * 20 + Math.random() * 5;
    arr.push({
      time: `2026-01-${String(i + 1).padStart(2, '0')}`,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.floor(3_000_000 + Math.random() * 8_000_000),
      sma20: Number(sma20.toFixed(2)),
      ema50: Number(ema50.toFixed(2)),
      rsi: Number(Math.min(85, Math.max(20, rsi)).toFixed(2)),
    });
    prev = close;
  }
  return arr;
};

export const stockUniverse: StockRecord[] = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corp',
    sector: 'Semiconductor',
    marketCap: '$2.9T',
    pe: 63.2,
    beta: 1.74,
    dividendYield: 0.03,
    earningsDate: '2026-02-25',
    summary: 'AI半導体の供給をリードし、データセンター需要の継続拡大で成長中。',
    valuation: [
      { metric: 'EV / EBITDA', value: '41.8x' },
      { metric: 'P / Sales', value: '27.3x' },
      { metric: 'PEG', value: '1.9x' },
    ],
    financials: [
      { period: '2023', revenue: 60900, ebitda: 30600, fcf: 27100 },
      { period: '2024', revenue: 121400, ebitda: 77400, fcf: 68200 },
      { period: '2025E', revenue: 148800, ebitda: 95100, fcf: 82800 },
    ],
    futureTargets: [
      { year: 2026, bull: 1420, base: 1250, bear: 980 },
      { year: 2027, bull: 1680, base: 1390, bear: 1050 },
    ],
    prices: makeSeries(1120, 34),
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    sector: 'Software',
    marketCap: '$3.1T',
    pe: 35.9,
    beta: 0.92,
    dividendYield: 0.69,
    earningsDate: '2026-01-29',
    summary: 'クラウドと生成AIソフトウェアの高収益モデルを持つ大型テック。',
    valuation: [
      { metric: 'EV / EBITDA', value: '24.1x' },
      { metric: 'P / Sales', value: '14.2x' },
      { metric: 'PEG', value: '2.2x' },
    ],
    financials: [
      { period: '2023', revenue: 211900, ebitda: 109400, fcf: 66300 },
      { period: '2024', revenue: 245100, ebitda: 127100, fcf: 77900 },
      { period: '2025E', revenue: 272500, ebitda: 144300, fcf: 92200 },
    ],
    futureTargets: [
      { year: 2026, bull: 620, base: 540, bear: 430 },
      { year: 2027, bull: 710, base: 590, bear: 460 },
    ],
    prices: makeSeries(480, 12),
  },
  {
    ticker: 'TSLA',
    name: 'Tesla',
    sector: 'Automotive',
    marketCap: '$890B',
    pe: 72.4,
    beta: 2.01,
    dividendYield: 0,
    earningsDate: '2026-01-22',
    summary: 'EV価格競争の中でエネルギー事業とFSD期待が評価の鍵。',
    valuation: [
      { metric: 'EV / EBITDA', value: '38.6x' },
      { metric: 'P / Sales', value: '8.1x' },
      { metric: 'PEG', value: '2.7x' },
    ],
    financials: [
      { period: '2023', revenue: 96700, ebitda: 14900, fcf: 4400 },
      { period: '2024', revenue: 112500, ebitda: 18200, fcf: 8800 },
      { period: '2025E', revenue: 129900, ebitda: 24500, fcf: 14200 },
    ],
    futureTargets: [
      { year: 2026, bull: 420, base: 330, bear: 200 },
      { year: 2027, bull: 510, base: 370, bear: 230 },
    ],
    prices: makeSeries(275, 14),
  },
];

export const defaultAlerts = [
  { id: 1, ticker: 'NVDA', condition: 'Price > 1300', active: true },
  { id: 2, ticker: 'TSLA', condition: 'RSI < 30', active: true },
];

export const initialPortfolio = [
  { ticker: 'MSFT', shares: 30, avgCost: 402 },
  { ticker: 'NVDA', shares: 12, avgCost: 1080 },
];
