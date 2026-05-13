const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RAILWAY HEARTBEAT (FIXES THE LOG ERRORS) ──────────────────────────────
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Scraper is Online");
}).listen(process.env.PORT || 3000);

// ─── DATA (YOUR ORIGINAL LISTS) ───────────────────────────────────────────
const RRP = { "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99, "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49, "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99, "build and battle": 24.99, "build & battle": 24.99, "pin collection": 34.99, "deluxe pin collection": 34.99, "premier deck": 49.99, "display box": 299.99, "league battle deck": 39.99, "premium collection": 49.99, "ultra premium collection": 119.99, "upc": 119.99 };

const RESELL = { "ascended heroes elite trainer box": 65, "ascended heroes etb": 65, "ascended heroes booster bundle": 38, "ascended heroes half box": 95, "ascended heroes collection box": 45, "destined rivals booster box": 130, "destined rivals elite trainer box": 58, "destined rivals booster bundle": 32, "destined rivals half box": 80, "perfect order booster box": 160, "perfect order elite trainer box": 60, "chaos rising booster box": 190, "chaos rising elite trainer box": 70, "phantasmal flames booster box": 280, "phantasmal flames elite trainer box": 90, "journey together booster box": 120, "journey together elite trainer box": 52, "journey together booster bundle": 28, "prismatic evolutions booster box": 220, "prismatic evolutions booster bundle": 90, "prismatic evolutions elite trainer box": 95, "surging sparks booster box": 155, "surging sparks elite trainer box": 60, "surging sparks booster bundle": 35, "stellar crown booster box": 190, "stellar crown elite trainer box": 65, "shrouded fable booster box": 110, "twilight masquerade booster box": 130, "twilight masquerade elite trainer box": 55, "temporal forces booster box": 115, "temporal forces elite trainer box": 52, "paradox rift booster box": 120, "paradox rift elite trainer box": 55, "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58, "paldea evolved booster box": 100, "paldean fates booster box": 140, "151 booster box": 180, "151 booster bundle": 55, "151 elite trainer box": 70, "evolving skies booster box": 800, "evolving skies elite trainer box": 180, "brilliant stars booster box": 150, "fusion strike booster box": 145, "lost origin booster box": 130, "silver tempest booster box": 125, "crown zenith booster box": 140, "astral radiance booster box": 130, "chilling reign booster box": 160, "battle styles booster box": 180, "shining fates booster box": 250, "vivid voltage booster box": 150, "darkness ablaze booster box": 140, "hidden fates booster box": 400, "hidden fates elite trainer box": 120, "champion path elite trainer box": 200, "cosmic eclipse booster box": 350 };

const SEALED_KEYWORDS = ["booster box", "elite trainer box", "etb", "half box", "booster bundle", "collection box", "poster collection", "build and battle", "build & battle", "pin collection", "deluxe pin collection", "premier deck", "display box", "mini tins", "ultra premium collection", "upc", "premium collection", "league battle deck"];
const EXCLUDE_KEYWORDS = ["yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon", "one piece", "dragon ball", "lorcana", "flesh and blood", "cardfight", "vanguard", "weiss", "buddyfight", "gundam", "single", "holo", "full art", "secret rare", "graded", "psa", "bgs", "cgc", "lot of", "proxy", "fake", "replica", "sleeve", "sleeves", "deck box", "playmat", "binder", "dice", "coin", "energy cards", "card lot", "bulk"];

const SEARCH_TERMS = ["pokemon tcg ascended heroes", "pokemon tcg destined rivals", "pokemon tcg prismatic evolutions", "pokemon tcg surging sparks", "pokemon tcg 151"];

const RETAILERS = [
  { name: "Total Cards", searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-item, .grid__item").each((_, el) => { const title = $(el).find(".product-item__title").text().trim(); const priceText = $(el).find(".price__regular").text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://totalcards.net${link}` }); }); return items; } },
  { name: "Chaos Cards", searchUrl: (q) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-item").each((_, el) => { const title = $(el).find(".product-title").text().trim(); const priceText = $(el).find(".price").text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://www.chaoscards.co.uk${link}` }); }); return items; } }
  // (Note: You can add your other retailers here following this format)
];

const notifiedUrls = new Set();

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    });
  } catch (e) { console.log("Telegram Error (Check Token):", e.response?.data?.description); }
}

async function runScan() {
  console.log("🔍 Scanning...");
  for (const term of SEARCH_TERMS) {
    for (const retailer of RETAILERS) {
      try {
        const res = await axios.get(retailer.searchUrl(term), { timeout: 10000 });
        const $ = cheerio.load(res.data);
        const results = retailer.parseResults($);

        for (const r of results) {
          const rrp = RRP["booster box"]; // Simplified for example
          if (!notifiedUrls.has(r.url)) {
            notifiedUrls.add(r.url);
            await sendTelegram(`✅ <b>New Stock!</b>\n${r.title}\n🏪 ${retailer.name}\n💰 £${r.price}\n<a href="${r.url}">Buy Now</a>`);
          }
        }
      } catch (e) { console.log(`Error scanning ${retailer.name}`); }
    }
  }
}

// Start sequence
async function init() {
  console.log("🚀 Bot Starting...");
  await sendTelegram("🚀 <b>Bot Online!</b>\nI am now scanning for Pokemon deals.");
  runScan();
  setInterval(runScan, 600000); // 10 minutes
}

init();
