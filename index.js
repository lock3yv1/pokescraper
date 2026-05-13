import fetch from 'node-fetch';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- 2026 MASTER MARKET DATA (Prices in GBP) ---
const MARKET_DATA = {
  // MEGA EVOLUTION ERA (2025-2026)
  "chaos rising": { pack: 5.75, bundle: 28.00, etb: 50.00, box: 155.00 }, // Launch: May 22, 2026
  "perfect order": { pack: 4.80, bundle: 30.00, etb: 45.00, box: 148.00 }, // Launch: Mar 27, 2026
  "ascended heroes": { pack: 5.20, bundle: 45.00, etb: 115.00, box: 240.00, tin: 8.99 }, // Jan 30 release
  "pitch black": { pack: 6.00, etb: 62.00, box: 165.00 }, // Upcoming: July 17, 2026
  "storm emerald": { box: 185.00, etb: 70.00 }, // Upcoming: July 31, 2026

  // SCARLET & VIOLET ERA
  "destined rivals": { pack: 5.00, bundle: 32.00, etb: 55.00, box: 148.00 }, // May 2025 Release
  "prismatic evolutions": { bundle: 85.00, etb: 115.00, upc: 224.95 },
  "surging sparks": { pack: 4.50, etb: 45.00, box: 145.00 },
  "151": { bundle: 95.00, etb: 135.00, box: 1400.00 },

  // SWORD & SHIELD GRAILS
  "evolving skies": { box: 2400.00, etb: 550.00, pack: 65.00 },
  "crown zenith": { etb: 75.00, tin: 30.00 },
  "fusion strike": { box: 310.00 },

  // VINTAGE (WOTC)
  "base set": { pack: 650.00, box: 35000.00 },
  "neo destiny": { pack: 700.00, box: 42000.00 },
  "skyridge": { pack: 1800.00, box: 85000.00 }
};

async function sendAlert(title, price, analysis) {
  const message = `🎰 **POKEMON DEAL FOUND**\n\n` +
    `📦 **ITEM:** ${title}\n` +
    `💰 **PRICE:** £${price.toFixed(2)}\n` +
    `📈 **MARKET:** £${analysis.market.toFixed(2)}\n` +
    `💸 **PROFIT:** £${analysis.profit}\n\n` +
    `🔥 *Analysis: High demand for ${analysis.type.toUpperCase()} detected.*`;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
  });
}

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // Exclude non-TCG items
  if (["plush", "shirt", "binder", "poster", "coin", "sticker"].some(word => t.includes(word))) return null;

  // Identify Product Type
  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : t.includes("tin") ? "tin" : t.includes("pack") ? "pack" : null;
  if (!type) return null;

  // Search for the set in our database
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  if (!setKey) return null;

  const market = MARKET_DATA[setKey][type];
  if (!market) return null;

  const profit = (market * 0.86 - price).toFixed(2);

  // Alert on any deal with > £10 estimated profit
  return (parseFloat(profit) > 10.00) ? { type, market, profit } : null;
}

async function run() {
  console.log("🚀 Initializing 2026 Multi-Era Scraper...");

  // EXAMPLE: This represents data coming in from your retailers
  const liveFeed = [
    { name: "Pokemon Destined Rivals Booster Box", price: 110.00 },
    { name: "Pokemon Chaos Rising Booster Pack", price: 3.95 },
    { name: "Pokemon Ascended Heroes ETB", price: 75.00 }
  ];

  for (const item of liveFeed) {
    const analysis = getAnalysis(item.name, item.price);
    if (analysis) {
      console.log(`✅ Profit Detected: ${item.name}`);
      await sendAlert(item.name, item.price, analysis);
    }
  }
  
  console.log("🏁 Scrape Complete.");
}

run().catch(err => { console.error(err); process.exit(1); });
