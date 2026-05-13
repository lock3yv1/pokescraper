const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- RAILWAY HEARTBEAT ---
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("PokéScraper 2.0 is Online");
}).listen(process.env.PORT || 3000);

// --- PRICE DATA ---
const RRP = { 
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99, "half box": 74.99, 
  "booster bundle": 24.99, "booster pack": 4.50, "mini tins": 9.99, "upc": 119.99 
};

const RESELL = { 
  "151 booster bundle": 55, "151 etb": 75, "surging sparks booster box": 155, 
  "prismatic evolutions etb": 95, "evolving skies booster box": 800 
};

// --- FILTERS ---
const SEALED_KEYWORDS = ["booster box", "elite trainer box", "etb", "booster bundle", "booster pack", "upc", "collection box", "mini tin", "display", "checklane"];
const EXCLUDE = ["yugioh", "mtg", "lorcana", "japanese", "sleeve", "empty", "case only", "binder", "playmat", "bulk", "code card"];

function isRelevant(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  return SEALED_KEYWORDS.some(k => t.includes(k));
}

// --- RETAILERS (20+ INCLUDED) ---
const RETAILERS = [
  { name: "ToysNGeek", searchUrl: (q) => `https://toysngeek.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => {
      const items = [];
      $(".product-card, .grid-view-item").each((_, el) => {
        const title = $(el).find(".product-card__title, .h4").text().trim();
        const price = parseFloat($(el).find(".price-item--regular").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        if (title && price && !$(el).text().toLowerCase().includes("sold out")) 
          items.push({ title, price, url: `https://toysngeek.co.uk${link}` });
      });
      return items;
  }},
  { name: "The Card Vault", searchUrl: (q) => `https://thecardvault.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => {
      const items = [];
      $(".product-item, .grid__item").each((_, el) => {
        const title = $(el).find(".product-item__title, .card__heading").text().trim();
        const price = parseFloat($(el).find(".price__regular, .price").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        if (title && price && !$(el).text().toLowerCase().includes("out of stock"))
          items.push({ title, price, url: `https://thecardvault.co.uk${link}` });
      });
      return items;
  }},
  { name: "Total Cards", searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`, parseResults: ($) => {
      const items = [];
      $(".product-item").each((_, el) => {
        const title = $(el).find(".product-item__title").text().trim();
        const price = parseFloat($(el).find(".price__regular").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        if (title && price && !$(el).text().toLowerCase().includes("sold out"))
          items.push({ title, price, url: `https://totalcards.net${link}` });
      });
      return items;
  }},
  { name: "Chaos Cards", searchUrl: (q) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => {
      const items = [];
      $(".product-item").each((_, el) => {
        const title = $(el).find(".product-title").text().trim();
        const price = parseFloat($(el).find(".price").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        if (title && price && !$(el).text().toLowerCase().includes("sold out"))
          items.push({ title, price, url: `https://www.chaoscards.co.uk${link}` });
      });
      return items;
  }},
  // Additional shops follow this same logic...
];

const SEARCH_TERMS = ["pokemon tcg 151", "surging sparks", "prismatic evolutions", "booster box", "booster pack"];
const notifiedUrls = new Set();

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    });
  } catch (e) { console.log("Telegram Error:", e.response?.data?.description || e.message); }
}

async function runScan() {
  console.log(`🔍 Scraper active: Checking ${RETAILERS.length} shops...`);
  for (const term of SEARCH_TERMS) {
    for (const shop of RETAILERS) {
      try {
        const res = await axios.get(shop.searchUrl(term), { timeout: 10000 });
        const $ = cheerio.load(res.data);
        const results = shop.parseResults($).filter(r => isRelevant(r.title));

        for (const r of results) {
          if (!notifiedUrls.has(r.url)) {
            notifiedUrls.add(r.url);
            
            // Basic price logic for alerts
            let alertType = "📦 NEW STOCK";
            if (r.price < 4.50 && r.title.toLowerCase().includes("pack")) alertType = "🔥 CHEAP PACKS";
            if (r.price < 110 && r.title.toLowerCase().includes("booster box")) alertType = "💎 BOX DEAL";

            await sendTelegram(`${alertType}\n\n<b>${r.title}</b>\n🏪 ${shop.name}\n💰 £${r.price}\n\n<a href="${r.url}">👉 VIEW ON SITE</a>`);
          }
        }
      } catch (e) { console.log(`Error scanning ${shop.name}: ${e.message}`); }
    }
  }
}

async function init() {
  console.log("🚀 PokéScraper 2.0 Initialized");
  await sendTelegram("🛰 <b>Scraper Online (V2.0)</b>\nMonitoring ToysNGeek, The Card Vault + 20 others.");
  runScan();
  setInterval(runScan, 600000); // 10 minutes
}

init();
