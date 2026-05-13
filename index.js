import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

[span_1](start_span)// MASTER MARKET DATA - ALL ERAS INCLUDED
const MARKET_DATA = {
  // --- 2026 MEGA EVOLUTION ERA ---
  "chaos rising": { pack: 5.50, bundle: 25.00, etb: 45.00, box: 145.00 }, // Launch May 22[span_1](end_span)
  "perfect order": { pack: 4.80, bundle: 30.00, etb: 52.00, box: 148.00 }, // Launch Mar 27
  "ascended heroes": { bundle: 45.00, etb: 115.00, box: 240.00 }, // Jan 30 (High Resale)
  "pitch black": { pack: 6.00, etb: 62.00, box: 165.00 }, // Mid-2026 Expected

  [span_2](start_span)// --- SCARLET & VIOLET / MODERN ---
  "151": { bundle: 95.00, etb: 135.00, box: 1400.00 },
  "prismatic": { bundle: 85.00, etb: 115.00 },
  "destined rivals": { pack: 5.00, box: 148.00 }, // May 2025 Release[span_2](end_span)
  "paldean fates": { etb: 55.00, tin: 22.00 },

  // --- SWORD & SHIELD ERA ---
  "evolving skies": { box: 2400.00, etb: 550.00, pack: 65.00 },
  "crown zenith": { etb: 75.00, tin: 30.00 },
  "fusion strike": { box: 310.00 },

  // --- VINTAGE (WOTC) ---
  "base set": { pack: 650.00, box: 35000.00 },
  "neo destiny": { pack: 700.00 },
  "skyridge": { pack: 1800.00, box: 85000.00 }
};

async function notifyTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
  });
}

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  const junk = ["bag", "plush", "shirt", "hat", "playmat", "sleeve", "binder", "poster"];
  if (junk.some(word => t.includes(word))) return null;

  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : t.includes("pack") ? "pack" : null;
  if (!type) return null;

  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  const market = (setKey && MARKET_DATA[setKey][type]) ? MARKET_DATA[setKey][type] : (price * 1.30);
  const profit = ((market * 0.86) - price).toFixed(2);

  return (parseFloat(profit) > 8.00) ? { type, market, profit } : null;
}

// Logic for scraping sites goes here (ensure URLs are valid)
console.log("Scraper Started...");
