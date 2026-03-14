// ══════════════════════════════════════════════
// FX — Currency rates, conversion, formatting
// Uses open.er-api.com (free, no key needed)
// Cache: 1 hour in S.fxCache
// ══════════════════════════════════════════════

const CURRENCIES = ['EUR','CHF','USD','GBP','PLN'];
const CURRENCY_SYMBOLS = {EUR:'€',CHF:'CHF',USD:'$',GBP:'£',PLN:'zł'};

// Format a base-currency amount
function fmtM(n) {
  const cur = (window.S?.currency) || 'CHF';
  const sym = CURRENCY_SYMBOLS[cur] || cur;
  const s = n < 0 ? '−' : '';
  const abs = Math.abs(n).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  // Put symbol before or after depending on currency
  if (cur === 'PLN') return s + abs + ' ' + sym;
  if (cur === 'CHF') return sym + ' ' + s + abs;
  return sym + s + abs;
}

function fmtSign(n) {
  const cur = (window.S?.currency) || 'CHF';
  const sym = CURRENCY_SYMBOLS[cur] || cur;
  const s = n >= 0 ? '+' : '−';
  const abs = Math.abs(n).toFixed(1);
  if (cur === 'PLN') return s + abs + ' ' + sym;
  if (cur === 'CHF') return sym + ' ' + s + abs;
  return sym + s + abs;
}

// Get rate: how many BASE units = 1 FOREIGN unit
function getRate(foreignCurrency) {
  const base = (window.S?.currency) || 'CHF';
  if (foreignCurrency === base) return 1;
  const rates = window.S?.fxCache?.rates;
  if (!rates) return 1;
  // rates are stored as: 1 base = X foreign
  // so to convert foreign→base: 1/rates[foreign]
  const r = rates[foreignCurrency];
  return r ? (1 / r) : 1;
}

// Convert amount in foreignCurrency to base currency
function convertToBase(amount, foreignCurrency) {
  return Math.round(amount * getRate(foreignCurrency) * 10) / 10;
}

// Fetch latest rates from open.er-api.com
async function fetchRates() {
  const base = (window.S?.currency) || 'CHF';
  const cache = window.S?.fxCache;
  const now = Date.now();
  // Use cache if < 1 hour old and same base
  if (cache && cache.base === base && cache.ts && (now - cache.ts) < 3600000) {
    return { ok: true, cached: true };
  }
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.result !== 'success') throw new Error('API error');
    window.S.fxCache = { base, rates: data.rates, ts: now };
    return { ok: true, cached: false };
  } catch(e) {
    console.warn('FX fetch failed:', e.message);
    return { ok: false, error: e.message };
  }
}

// Recompute amountBase for all events when base currency or rates change
function recomputeAllBase() {
  if (!window.S) return;
  window.S.recurring.forEach(r => {
    if (r.currency && r.currency !== window.S.currency) {
      const raw = r.amountOriginal ?? Math.abs(r.amount);
      const converted = convertToBase(raw, r.currency);
      r.amount = r.kind === 'saving' ? Math.abs(converted) :
        (r.amountOriginal_sign ?? (r.amount >= 0 ? 1 : -1)) * converted;
    }
  });
  window.S.oneTime.forEach(e => {
    if (e.currency && e.currency !== window.S.currency) {
      const raw = e.amountOriginal ?? Math.abs(e.amount);
      const sign = e.amountOriginal_sign ?? (e.amount >= 0 ? 1 : -1);
      e.amount = sign * convertToBase(raw, e.currency);
    }
  });
}
