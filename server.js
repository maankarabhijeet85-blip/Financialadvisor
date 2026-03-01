require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── STOCK DATA via Yahoo Finance (free, no key needed) ───────────────────────
async function fetchStockData(symbol) {
  try {
    // Yahoo Finance symbol for NSE stocks
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=6mo`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    const data = res.data.chart.result[0];
    const quotes = data.indicators.quote[0];
    const timestamps = data.timestamps;
    const meta = data.meta;

    return {
      symbol: yahooSymbol,
      name: meta.longName || symbol,
      currentPrice: meta.regularMarketPrice,
      currency: meta.currency,
      exchange: meta.exchangeName,
      timestamps: timestamps.map(t => new Date(t * 1000).toISOString().split('T')[0]),
      close: quotes.close,
      open: quotes.open,
      high: quotes.high,
      low: quotes.low,
      volume: quotes.volume,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      previousClose: meta.previousClose,
    };
  } catch (e) {
    throw new Error(`Could not fetch data for ${symbol}: ${e.message}`);
  }
}

// ─── TECHNICAL INDICATORS ─────────────────────────────────────────────────────
function calcSMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(prices, period) {
  const ema = [];
  const k = 2 / (period + 1);
  prices.forEach((price, i) => {
    if (i === 0) { ema.push(price); return; }
    ema.push(price * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

function calcRSI(prices, period = 14) {
  const rsi = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) { rsi.push(null); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j] - prices[j - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = gains / (losses || 1);
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine.filter(v => v !== null), 9);
  return { macdLine, signal };
}

function calcBollingerBands(prices, period = 20) {
  const sma = calcSMA(prices, period);
  return prices.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const std = Math.sqrt(slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period);
    return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
  });
}

function computeTechnicals(stockData) {
  const closes = stockData.close.filter(v => v !== null);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const ema20 = calcEMA(closes, 20);
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const bb = calcBollingerBands(closes);

  const last = closes[closes.length - 1];
  const lastRSI = rsi[rsi.length - 1];
  const lastSMA20 = sma20[sma20.length - 1];
  const lastSMA50 = sma50[sma50.length - 1];
  const lastBB = bb[bb.length - 1];
  const lastMACD = macd.macdLine[macd.macdLine.length - 1];
  const lastSignal = macd.signal[macd.signal.length - 1];

  // Signal analysis
  const signals = [];
  let bullCount = 0, bearCount = 0;

  if (lastRSI < 30) { signals.push({ type: 'BUY', reason: `RSI oversold at ${lastRSI?.toFixed(1)}` }); bullCount++; }
  else if (lastRSI > 70) { signals.push({ type: 'SELL', reason: `RSI overbought at ${lastRSI?.toFixed(1)}` }); bearCount++; }
  else { signals.push({ type: 'NEUTRAL', reason: `RSI neutral at ${lastRSI?.toFixed(1)}` }); }

  if (lastSMA20 && lastSMA50) {
    if (lastSMA20 > lastSMA50) { signals.push({ type: 'BUY', reason: 'SMA20 above SMA50 (bullish crossover zone)' }); bullCount++; }
    else { signals.push({ type: 'SELL', reason: 'SMA20 below SMA50 (bearish crossover zone)' }); bearCount++; }
  }

  if (last < lastBB?.lower) { signals.push({ type: 'BUY', reason: 'Price below Bollinger lower band' }); bullCount++; }
  else if (last > lastBB?.upper) { signals.push({ type: 'SELL', reason: 'Price above Bollinger upper band' }); bearCount++; }

  if (lastMACD && lastSignal) {
    if (lastMACD > lastSignal) { signals.push({ type: 'BUY', reason: 'MACD above signal line' }); bullCount++; }
    else { signals.push({ type: 'SELL', reason: 'MACD below signal line' }); bearCount++; }
  }

  const overallSignal = bullCount > bearCount ? 'BUY' : bearCount > bullCount ? 'SELL' : 'HOLD';

  return {
    current: last,
    rsi: lastRSI,
    sma20: lastSMA20,
    sma50: lastSMA50,
    ema20: ema20[ema20.length - 1],
    bb: lastBB,
    macd: { line: lastMACD, signal: lastSignal },
    signals,
    overallSignal,
    bullCount,
    bearCount,
    chartData: {
      dates: stockData.timestamps.slice(-60),
      closes: closes.slice(-60),
      sma20: sma20.slice(-60),
      sma50: sma50.slice(-60),
      rsi: rsi.slice(-60),
      bbUpper: bb.slice(-60).map(b => b.upper),
      bbLower: bb.slice(-60).map(b => b.lower),
    }
  };
}

// ─── NEWS SCRAPING ─────────────────────────────────────────────────────────────
async function fetchMarketNews() {
  try {
    // Using a reliable RSS-style endpoint
    const urls = [
      'https://economictimes.indiatimes.com/markets/stocks/rss.cms',
      'https://www.moneycontrol.com/rss/marketoutlook.xml'
    ];

    const newsItems = [];

    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000
        });
        const xml = res.data;
        // Simple regex parse for RSS
        const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(m => m[1]);
        const descs = [...xml.matchAll(/<description><!\[CDATA\[(.*?)\]\]><\/description>/g)].map(m => m[1]);
        const links = [...xml.matchAll(/<link>(.*?)<\/link>/g)].map(m => m[1]);

        for (let i = 1; i < Math.min(titles.length, 6); i++) {
          newsItems.push({
            title: titles[i],
            description: descs[i] ? descs[i].replace(/<[^>]*>/g, '').substring(0, 200) : '',
            link: links[i] || '#'
          });
        }
      } catch (_) {}
    }

    return newsItems.slice(0, 8);
  } catch (e) {
    return [];
  }
}

// ─── AI ANALYSIS via Claude API ───────────────────────────────────────────────
async function getAIAnalysis(prompt) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    return '⚠️ Please add your Anthropic API key in the .env file to enable AI analysis. Get a free key at https://console.anthropic.com';
  }
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    timeout: 30000
  });
  return res.data.content[0].text;
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Analyse a stock
app.post('/api/analyze-stock', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  try {
    const stockData = await fetchStockData(symbol.toUpperCase());
    const technicals = computeTechnicals(stockData);

    const prompt = `You are an expert Indian stock market analyst. Analyze the following technical data for ${stockData.name} (${symbol.toUpperCase()}) listed on NSE/BSE:

CURRENT PRICE: ₹${technicals.current?.toFixed(2)}
52-Week High: ₹${stockData.fiftyTwoWeekHigh}
52-Week Low: ₹${stockData.fiftyTwoWeekLow}

TECHNICAL INDICATORS:
- RSI (14): ${technicals.rsi?.toFixed(2)} 
- SMA 20: ₹${technicals.sma20?.toFixed(2)}
- SMA 50: ₹${technicals.sma50?.toFixed(2)}
- EMA 20: ₹${technicals.ema20?.toFixed(2)}
- Bollinger Bands: Upper ₹${technicals.bb?.upper?.toFixed(2)}, Lower ₹${technicals.bb?.lower?.toFixed(2)}
- MACD Line: ${technicals.macd?.line?.toFixed(4)}, Signal: ${technicals.macd?.signal?.toFixed(4)}

SIGNALS: ${technicals.signals.map(s => `${s.type}: ${s.reason}`).join(' | ')}
OVERALL SIGNAL: ${technicals.overallSignal}

Please provide:
1. **Market Outlook** (2-3 sentences)
2. **Entry Point**: Suggest ideal buy price range
3. **Exit / Target**: Short-term (1-3 months) and medium-term (6-12 months) targets
4. **Stop Loss**: Recommended stop loss level
5. **Risk Level**: Low/Medium/High with reasoning
6. **Investment Recommendation**: Buy now / Wait for dip / Avoid

Format your response in clear sections. Be specific with price levels in INR (₹). Keep it concise and actionable.`;

    const aiAnalysis = await getAIAnalysis(prompt);

    res.json({
      stock: stockData,
      technicals,
      aiAnalysis,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SIP & Investment advisor
app.post('/api/sip-advisor', async (req, res) => {
  const { monthlyAmount, riskProfile, goal, duration, age } = req.body;

  const prompt = `You are a certified Indian financial advisor. Create a personalized SIP & investment plan for this user:

USER PROFILE:
- Age: ${age} years
- Monthly SIP Budget: ₹${monthlyAmount}
- Risk Profile: ${riskProfile} (Conservative/Moderate/Aggressive)
- Financial Goal: ${goal}
- Investment Duration: ${duration} years

Please provide:
1. **Recommended SIP Allocation** (break ₹${monthlyAmount} into specific fund categories with amounts):
   - Large Cap Funds
   - Mid Cap Funds  
   - Small Cap Funds
   - ELSS (Tax Saving)
   - Debt/Hybrid Funds
   - Gold ETF/Funds
   - International Funds

2. **Specific Fund Recommendations** (name 2-3 top-performing funds in each category suitable for Indian investors)

3. **Expected Returns**:
   - Conservative estimate (8%)
   - Moderate estimate (12%)
   - Optimistic estimate (15%)
   - Projected corpus after ${duration} years

4. **Tax Benefits** available

5. **Key Tips** for this specific profile

Be specific with fund names (actual Indian mutual funds like Mirae Asset, Axis, HDFC, SBI, etc.). Include XIRR/CAGR expectations. Format clearly.`;

  try {
    const aiAdvice = await getAIAnalysis(prompt);
    res.json({ advice: aiAdvice });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// News + AI market summary
app.get('/api/market-news', async (req, res) => {
  try {
    const news = await fetchMarketNews();
    
    let aiSummary = '';
    if (news.length > 0) {
      const newsTitles = news.map((n, i) => `${i + 1}. ${n.title}`).join('\n');
      const prompt = `You are an Indian stock market expert. Based on these recent market headlines, provide a brief market sentiment analysis and 2-3 actionable trading ideas for Indian retail investors today:\n\n${newsTitles}\n\nKeep response under 300 words. Be specific about sectors or stocks.`;
      aiSummary = await getAIAnalysis(prompt);
    }

    res.json({ news, aiSummary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ask anything (chat)
app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;
  const prompt = `You are FinAI, an expert Indian stock market and financial advisor assistant. You have deep knowledge of NSE, BSE, Indian mutual funds, SEBI regulations, and Indian taxation.

${context ? `Context: ${context}\n` : ''}
User question: ${message}

Provide helpful, accurate, and actionable advice specific to Indian markets. If asked about specific stocks, include technical analysis context. Always mention risk factors. Keep response clear and structured.`;

  try {
    const reply = await getAIAnalysis(prompt);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Popular Indian stocks list
app.get('/api/popular-stocks', (req, res) => {
  res.json([
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
    { symbol: 'ITC', name: 'ITC Limited' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
    { symbol: 'WIPRO', name: 'Wipro' },
    { symbol: 'AXISBANK', name: 'Axis Bank' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises' },
  ]);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
