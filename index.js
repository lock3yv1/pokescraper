import fetch from 'node-fetch';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- 2026 INTELLIGENCE DATABASE ---
const MARKET_DATA = {
  // MEGA EVOLUTION SERIES (2026)
  "chaos rising": { pack: 5.75, bundle: 28.00, etb: 50.00, box: 155.00, status: "May 22 Release" }, //
  "perfect order": { pack: 4.80, bundle: 30.00, etb: 45.00, box: 148.00, status: "Mar 27 Release" }, //
  "ascended heroes": { bundle: 45.00, etb: 115.00, box: 240.00, status: "Booster Bundles Apr 24" }, //
  "abyss eye": { box: 165.00, pack: 6.00, status: "Japanese May 22" }, //

  // SCARLET & VIOLET LEGACY
  "destined rivals": { pack: 5.00, bundle: 32.00, etb: 55.00, box: 148.00, status: "May 2025 Release" }, //
  "151": { bundle: 95.00, etb: 135.00, box: 1400.00, status: "High Demand Spike" },

  // WOTC VINTAGE GRAILS
  "base set": { pack: 650.00, box: 35000.00 },
  "neo destiny": { pack: 700.00, box: 42000.00 }
};

async function sendAlert(title, price, analysis) {
  const message = `📊 **MARKET INTEL REPORT**\n\n` +
    `📦 **ITEM:** ${title}\n` +
    `💰 **LIST PRICE:** £${price.toFixed(2)}\n` +
    `📈 **MARKET VALUE:** £${analysis.market.toFixed(2)}\n` +
    `📉 **DELTA:** -${analysis.delta}% Below Market\n` +
    `💸 **NET PROFIT:** £${analysis.profit} (After 14% Fees)\n\n` +
    `📢 **STATUS:** ${analysis.status}\n` +
    `🔥 **RATING:** ${analysis.rating}`;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
  });
}

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : t.includes("pack") ? "pack" : null;
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  
  if (!type || !setKey) return null;

  const market = MARKET_DATA[setKey][type];
  if (!market) return null;

  const profit = (market * 0.86 - price).toFixed(2);
  const delta = (((market - price) / market) * 100).toFixed(1);
  const status = MARKET_DATA[setKey].status || "Stable Market";
  
  // Rating logic
  const rating = parseFloat(profit) > 50 ? "💎 GRAIL" : parseFloat(profit) > 20 ? "🚀 STEAL" : "✅ PROFITABLE";

  return (parseFloat(profit) > 5.00) ? { market, profit, delta, status, type, rating } : null;
}

async function run() {
  console.log("🚀 Initializing PokeScraper 2026 Pro Intelligence Engine...");

  // Mock results for immediate testing
  const feed = [
    { name: "Pokemon Chaos Rising Booster Box", price: 115.00 }, // Upcoming May 22 Release
    { name: "Pokemon Destined Rivals Booster Box", price: 110.00 }, //
    { name: "Pokemon Ascended Heroes ETB", price: 75.00 } //
  ];

  for (const item of feed) {
    const analysis = getAnalysis(item.name, item.price);
    if (analysis) await sendAlert(item.name, item.price, analysis);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
