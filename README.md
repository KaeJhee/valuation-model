# Ghost Strategies — Universal Valuation Model

A production-grade Bull / Base / Bear stock valuation workbench with probability-weighted expected value, powered by a dual-API architecture: **Finnhub** for live quotes and fundamentals, **Financial Modeling Prep (FMP)** for analyst price targets and consensus grades.

---

## Features

- **Universal** — Works for any US-listed stock. Type a ticker, hit FETCH, and fundamentals auto-populate
- **Dual API architecture** — Finnhub (free, 60 calls/min) handles real-time quotes, company profiles, EPS, revenue, margins, and recommendations. FMP (free, 250 calls/day) handles analyst price target consensus and grades
- **Three-scenario framework** — Bull / Base / Bear with fully editable price targets, EPS, revenue, margins, CAGR, thesis narratives, and key drivers
- **Probability-weighted EV** — Interactive sliders to assign conviction weights; model computes expected market cap, price, EPS, and revenue in real-time
- **Live polling** — 15-second refresh during market hours, 60-second off-hours. Price flashes green/red on tick direction
- **Valuation spectrum** — Visual scale bar plotting current market, analyst consensus, and all three scenarios
- **Revenue path chart** — SVG chart with editable midpoint estimates
- **Save / Load** — Persist multiple stock models to localStorage
- **Debug panel** — Inspect raw API responses from every endpoint to verify data accuracy
- **Ghost Strategies branding** — Dark terminal aesthetic, JetBrains Mono + DM Sans

---

## API Architecture

| Data Point | Source | Endpoint | Tier |
|---|---|---|---|
| Live price, prev close, day range | Finnhub | `/quote` | Free |
| Company name, exchange, shares | Finnhub | `/stock/profile2` | Free |
| EPS TTM, revenue TTM, margins, 52W range | Finnhub | `/stock/metric` | Free |
| Buy/sell/hold breakdown | Finnhub | `/stock/recommendation` | Free |
| Analyst avg/high/low price target | FMP | `/stable/price-target-consensus` | Free |
| Consensus rating (Strong Buy → Strong Sell) | FMP | `/stable/upgrades-downgrades-consensus` | Free |

Both APIs are called in parallel on ticker lookup. If one fails, the other still populates what it can.

---

## Quick Start — Run Locally

### Prerequisites

Install **Node.js** from [nodejs.org](https://nodejs.org) (LTS version). Restart your terminal after installing.

### Steps

```bash
# 1. Unzip and navigate to the project
cd ~/Downloads/valuation-model

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open the localhost URL it shows you (usually `http://localhost:5173/valuation-model/`).

### Connect Your APIs

1. Get a free Finnhub key: [finnhub.io/register](https://finnhub.io/register)
2. Get a free FMP key: [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs/pricing) (sign up, free plan)
3. In the app, click **⚙ API** → paste both keys → **CONNECT**
4. Keys are saved to localStorage — enter them once

### Model a New Stock

1. Click **EDIT**
2. Type a ticker in the green badge (e.g., `AAPL`)
3. Click **↻ FETCH** — both APIs fire in parallel
4. Fundamentals + analyst data auto-populate
5. Set your Bull / Base / Bear assumptions
6. Adjust probability sliders
7. Click **SAVE**

---

## Deploy to GitHub Pages

```bash
# 1. Initialize git
git init
git add .
git commit -m "Initial commit - Valuation Model"
git branch -M main

# 2. Create repo at github.com/new (name: valuation-model, Public, no README)
git remote add origin https://github.com/YOUR_USERNAME/valuation-model.git
git push -u origin main

# 3. Enable Pages: Settings → Pages → Source: GitHub Actions
# 4. Wait ~90 seconds for green checkmark in Actions tab
# 5. Live at: https://YOUR_USERNAME.github.io/valuation-model/
```

### Updating After Changes

```bash
git add .
git commit -m "describe changes"
git push
```

Auto-redeploys in ~1 minute.

---

## Project Structure

```
valuation-model/
├── .github/workflows/deploy.yml  ← Auto-deploy to GitHub Pages
├── src/
│   ├── main.jsx                  ← React entry point
│   └── App.jsx                   ← Full application (849 lines)
├── index.html                    ← HTML shell
├── package.json                  ← Dependencies
├── vite.config.js                ← Build config (edit base path here)
└── README.md
```

---

## Troubleshooting

**Price targets show old data after switching tickers** — Click ↻ FETCH after changing the ticker. The app doesn't auto-fetch on ticker change to avoid burning API calls.

**FMP returns empty for price targets** — Some smaller-cap or international tickers may not have analyst coverage in FMP's free tier. The debug panel (⚙ API → view response) shows exactly what came back.

**"npm: command not found"** — Restart your terminal or reinstall Node.js.

**Blank page after GitHub Pages deploy** — Check that `base` in `vite.config.js` matches your repo name exactly: `base: '/gs-valuation-model/'`

**Want a different repo name?** — Change `base` in `vite.config.js` and the `git remote` URL to match.

---

## Tech Stack

- **React 18** + **Vite 5** — UI and build
- **Finnhub API** — Real-time quotes and fundamentals (free tier)
- **Financial Modeling Prep API** — Analyst price targets and grades (free tier)
- **GitHub Actions** — CI/CD auto-deploy
- **localStorage** — Model persistence + API key storage

---

*Ghost Strategies LLC — For informational purposes only. Not financial advice.*
