import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- MASTER MARKET DATA: 1999 to 2026 ---
const MARKET_DATA = {
  // 2026 MEGA EVOLUTION ERA
  "chaos rising": { pack: 5.50, bundle: 28.00, etb: 50.00, box: 155.00, tin: 24.00 }, // Launch: May 22, 2026
  "abyss eye": { pack: 6.00, box: 165.00 }, // Japanese Launch: May 22, 2026
  "perfect order": { pack: 4.80, bundle: 30.00, etb: 52.00, box: 148.00 }, // Released: Mar 27, 2026
  "ascended heroes": { bundle: 45.00, etb: 115.00, box: 240.00, tin: 35.00 }, // Jan 30 release
  "pitch black": { pack: 6.00, etb: 62.00, box: 165.00 }, // Arriving: July 17, 2026
  "storm emerald": { box: 185.00, etb: 70.00 }, // Expected: July 31, 2026

  // SCARLET & VIOLET ERA
  "151": { bundle: 95.00, etb: 135.00, box: 1400.00, upc: 215.00 },
  "prismatic evolutions": { bundle: 85.00, etb: 115.00, upc: 185.00 },
  "destined rivals": { pack: 5.00, box: 148.00 }, // 2025 Release
  "surging sparks": { box: 145.00, etb: 45.00 },
  "shrouded fable": { etb: 50.00, box: 140.00 },

  // SWORD & SHIELD GRAILS
  "evolving skies": { box: 2400.00, etb: 550.00, pack: 65.00 },
  "celebrations": { etb: 110.00, upc: 550.00, box: 350.00 },
  "crown zenith": { etb: 75.00, tin: 30.00 },
  "fusion strike": { box: 310.00 },

  // VINTAGE (WOTC)
  "base set": { pack: 650.00, box: 35000.00 },
  "neo destiny": { pack: 700.00, box: 42000.00 },
  "skyridge": { pack: 1800.00, box: 85000.00 },
  "aquapolis": { pack: 1200.00 }
};

// --- CORE UTILITIES ---
async function sendAlert(title, shop, price, analysis) {
  const message = `🎰 **POKEMON DEAL FOUND**\n\n` +
    `📦 **ITEM:** ${title}\n` +
    `🏪 **SHOP:** ${shop}\n` +
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
  
  // Junk Filter
  if (["bag", "plush", "shirt", "binder", "poster"].some(word => t.includes(word))) return null;

  // Type Matcher
  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : t.includes("tin") ? "tin" : t.includes("pack") ? "pack" : null;
  if (!type) return null;

  // Set Searcher
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  if (!setKey) return null;

  const market = MARKET_DATA[setKey][type] || (price * 1.25);
  const profit = (market * 0.86 - price).toFixed(2);

  return (parseFloat(profit) > 5.00) ? { type, market, profit } : null;
}

// --- MAIN RUNNER ---
async function run() {
  console.log("🚀 Initializing 2026 Multi-Era Scraper...");
  // Example Scrape Logic (You'll add your retailer fetch calls here)
  const sampleShop = "Total Cards";
  const sampleItem = "Pokemon Mega Evolution Chaos Rising Booster Box"; // cite: 2.6.1
  const samplePrice = 135.00;

  const analysis = getAnalysis(sampleItem, samplePrice);
  if (analysis) {
    await sendAlert(sampleItem, sampleShop, samplePrice, analysis);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
