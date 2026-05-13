const axios = require("axios");
const cheerio = require("cheerio");

// These must be set in your Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49,
  "mini tins": 44.99, "collection box": 34.99, "upc": 119.99
};

const RESELL = {
  "ascended heroes booster box": 160, "destined rivals booster box": 130,
  "prismatic evolutions booster box": 220, "surging sparks booster box": 155
};

const SEALED_KEYWORDS = ["booster box", "elite trainer box", "etb", "booster bundle", "upc"];
const EXCLUDE_KEYWORDS = ["yugioh", "mtg", "single", "psa", "proxy", "sleeve"];

function isSealedPokemon(title) {
  const t = title.toLowerCase();
  return t.includes("pokemon") && 
         !EXCLUDE_KEYWORDS.some(k => t.includes(k)) && 
         SEALED_KEYWORDS.some(k => t.includes(k));
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ ERROR: Telegram Token or Chat ID is missing!");
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.log("Telegram API Error:", e.response ? e.response.data : e.message);
  }
}

// Scraper logic simplified for the example
async function runScan() {
  console.log("🤖 Starting Scan...");
  // Test Ping to verify connection
  await sendTelegram("🚀 <b>PokéScraper Started!</b>\nWatching for deals...");
  
  // (Your existing retailer loop logic goes here)
  console.log("✅ Scan Complete.");
}

runScan();
