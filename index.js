import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// MASTER MARKET DATA - ALL ERAS INCLUDED
const MARKET_DATA = {
  // --- 2026 CURRENT ERA ---
  "chaos rising": { pack: 5.75, bundle: 34.00, etb: 58.00, box: 158.00, tin: 26.00 },
  "ascended heroes": { pack: 11.50, bundle: 45.00, etb: 115.00, box: 240.00, tin: 35.00 },
  "perfect order": { pack: 4.80, bundle: 30.00, etb: 54.00, box: 152.00 },
  "pitch black": { pack: 6.00, bundle: 36.00, etb: 62.00, box: 165.00 },

  // --- SCARLET & VIOLET ERA ---
  "prismatic evolutions": { bundle: 85.00, etb: 115.00, upc: 185.00 },
  "destined rivals": { pack: 5.00, bundle: 30.00, etb: 52.00, box: 148.00 },
  "black bolt": { box: 190.00, etb: 75.00 },
  "151": { bundle: 95.00, etb: 135.00, upc: 215.00, box: 1400.00 },
  "paldean fates": { etb: 55.00, tin: 22.00 },
  "shrouded fable": { box: 140.00, etb: 50.00 },

  // --- SWORD & SHIELD ERA (The Modern Grails) ---
  "evolving skies": { box: 2400.00, etb: 550.00, pack: 65.00 },
  "crown zenith": { etb: 75.00, tin: 30.00 },
  "brilliant stars": { box: 210.00, etb: 65.00 },
  "celebrations": { etb: 110.00, box: 350.00, upc: 550.00 },
  "fusion strike": { box: 310.00 },
  "team up": { box: 4500.00, pack: 180.00 },

  // --- VINTAGE / LEGACY ERA ---
  "base set": { pack: 650.00, box: 35000.00 },
  "fossil": { pack: 250.00 },
  "jungle": { pack: 250.00 },
  "neo destiny": { pack: 700.00, box: 42000.00 },
  "skyridge": { pack: 1800.00, box: 85000.00 },
  "aquapolis": { pack: 1200.00 }
};

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  
  // 1. FILTER JUNK (No accessories unless they are "Collections")
  const junk = ["bag", "plush", "shirt", "hat", "playmat", "sleeve", "binder", "socks", "poster", "empty", "storage"];
  if (junk.some(word => t.includes(word) && !t.includes("collection"))) return null;

  // 2. PRODUCT TYPE DETECTION
  let type = null;
  if (t.includes("booster box") || t.includes("display")) type = "box";
  else if (t.includes("etb") || t.includes("elite trainer")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("tin")) type = "tin";
  else if (t.includes("collection") || t.includes("upc") || t.includes("premium")) type = "collection";
  else if (t.includes("pack") || t.includes("sleeved")) type = "pack";

  if (!type) return null;

  // 3. UNIVERSAL SET DETECTION (Scanning everything from 1999 to 2026)
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  
  // 4. PROFIT & NOTIFICATION LOGIC
  // If the item is significantly below our market data, it's a "Deal"
  const market = (setKey && MARKET_DATA[setKey][type]) ? MARKET_DATA[setKey][type] : (price * 1.25); 
  const profit = ((market * 0.86) - price).toFixed(2);

  // Trigger if it's a known high-value set OR has over £10 estimated profit
  const isHighValue = t.match(/151|evolving|skies|skyridge|destiny|chaos|heroes|prismatic|anniversary|upc/i);
  const isDeal = isHighValue || parseFloat(profit) > 10.00;

  return isDeal ? { type, market, profit } : null;
}

// ... (Fetch loop and Telegram messaging remains the same)
