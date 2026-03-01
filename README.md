# 📈 FinAI — Indian Stock Market Advisor

An AI-powered Indian stock market analysis platform with real-time technical analysis, Claude AI insights, SIP planning, and live market news.

## ✨ Features

- **Stock Analyzer** — Real-time NSE data with RSI, MACD, Bollinger Bands, SMA/EMA
- **AI Analysis** — Claude AI generates entry, exit points, stop-loss levels, risk assessment
- **SIP Planner** — Personalized mutual fund recommendations based on your profile
- **Market News** — Live news from MoneyControl & ET with AI sentiment analysis
- **AI Chat** — Ask anything about Indian stocks, mutual funds, tax planning

## 🚀 Quick Start (Local)

### 1. Clone / Download
```bash
git clone https://github.com/YOUR_USERNAME/finai-advisor.git
cd finai-advisor
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up API key
```bash
cp .env.example .env
```
Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```
Get a free key at: https://console.anthropic.com

### 4. Run
```bash
npm start
```
Open http://localhost:3000

For development (auto-restart):
```bash
npm run dev
```

## 🌐 Deploy to Render.com (Free Hosting)

1. Push your code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set these:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add Environment Variable: `ANTHROPIC_API_KEY` = your key
6. Deploy!

## 🌐 Deploy to Railway.app

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add `ANTHROPIC_API_KEY` in Variables
4. Deploy!

## 📁 Project Structure

```
finai-advisor/
├── server.js          # Express backend + API routes
├── public/
│   └── index.html     # Full frontend (single file)
├── package.json
├── .env.example       # Template for environment variables
├── .gitignore
└── README.md
```

## 🔑 API Used

| API | Cost | Purpose |
|-----|------|---------|
| Yahoo Finance | Free | Real-time NSE stock prices |
| Anthropic Claude | Pay-per-use (~$0.003/analysis) | AI analysis |
| MoneyControl RSS | Free | Market news |
| Economic Times RSS | Free | Market news |

## ⚠️ Disclaimer

This tool is for **educational and informational purposes only**. It does not constitute financial advice. Please consult a SEBI-registered investment advisor before making investment decisions. Stock markets are subject to market risks.

## 🛠️ Customization

- Add more stocks to `popular-stocks` in `server.js`
- Modify technical analysis parameters in `computeTechnicals()`
- Change AI prompt style in the route handlers
- Add more chart types using Chart.js

## 📋 Requirements

- Node.js 16+
- Anthropic API key (get free at console.anthropic.com)
- Internet connection (for live stock data)
