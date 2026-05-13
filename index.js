const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- RAILWAY KEEP-ALIVE ---
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("PokéScraper is Online");
}).listen(process.env.PORT || 3000);

// --- DATA ---
const RRP = { "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99, "half box": 74.99, "booster bundle": 24.99, "upc": 119.99 };
const RESELL = { "surging sparks booster box": 155, "prismatic evolutions etb": 95, "151 booster bundle": 55 };

const SEARCH_TERMS = ["pokemon tcg 151", "surging sparks booster box", "prismatic evolutions"];
const RETAILERS = [
  { name: "Total Cards", searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-item").each((_, el) => { const title = $(el).find(".product-item__title").text().trim(); const price = parseFloat($(el).find(".price__regular").text().replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && price) items.push({ title, price, url: `https://totalcards.net${link}` }); }); return items; } }
];

const notifiedUrls = new Set();

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.log("❌ TELEGRAM ERROR:", e.response?.data?.description || e.message);
    console.log("👉 Check your TELEGRAM_CHAT_ID variable in Railway!");
  }
}

async function runScan() {
  console.log("🔍 Scanning for deals...");
  for (const term of SEARCH_TERMS) {
    for (const retailer of RETAILERS) {
      try {
        const res = await axios.get(retailer.searchUrl(term));
        const $ = cheerio.load(res.data);
        const results = retailer.parseResults($);
        for (const r of results) {
          if (!notifiedUrls.has(r.url)) {
            notifiedUrls.add(r.url);
            await sendTelegram(`✅ <b>Found:</b> ${r.title}\n💰 £${r.price}\n<a href="${r.url}">Link</a>`);
          }
        }
      } catch (e) { console.log(`Error on ${retailer.name}`); }
    }
  }
}

async function init() {
  console.log("🚀 Bot starting...");
  // This test message will confirm if your Chat ID is finally correct
  await sendTelegram("🚀 <b>Scraper Connection Successful!</b>");
  runScan();
  setInterval(runScan, 600000); 
}

init();
