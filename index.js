const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http");

// 1. Setup Railway Server (Mandatory)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is alive");
}).listen(process.env.PORT || 3000);

// 2. Load Variables
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 3. Simple Telegram Function
async function sendMsg(text) {
  if (!TOKEN || !CHAT_ID) return console.log("Missing Variables!");
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.log("Telegram Error:", e.response?.data?.description || e.message);
  }
}

// 4. Scraper Data (Your Prices/Retailers)
const SEARCH_TERMS = ["pokemon 151", "surging sparks", "prismatic evolutions"];
const RETAILERS = [
  { 
    name: "Total Cards", 
    url: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`,
    parse: ($) => {
      const items = [];
      $(".product-item").each((_, e) => {
        items.push({ 
          title: $(e).find(".product-item__title").text().trim(),
          price: $(e).find(".price__regular").text().trim(),
          link: "https://totalcards.net" + $(e).find("a").attr("href")
        });
      });
      return items;
    }
  }
];

// 5. Main Execution
async function start() {
  console.log("🚀 Starting...");
  await sendMsg("🛰 <b>PokéScraper Online</b>\nConnection established from iPhone.");
  
  const run = async () => {
    for (const term of SEARCH_TERMS) {
      for (const shop of RETAILERS) {
        try {
          const res = await axios.get(shop.url(term));
          const $ = cheerio.load(res.data);
          const deals = shop.parse($);
          if (deals.length > 0) {
            console.log(`Found ${deals.length} items at ${shop.name}`);
          }
        } catch (err) { console.log("Scan error"); }
      }
    }
  };

  run();
  setInterval(run, 600000); // 10 mins
}

start();
