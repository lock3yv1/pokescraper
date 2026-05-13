import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "chaos rising": { box: 155, etb: 55, bundle: 32, strategy: "New Release 🚀" }, // Upcoming May 22
  "151": { box: 190, bundle: 70, etb: 85, upc: 150, strategy: "Long Term 💎" },
  "evolving skies": { box: 880, etb: 210, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 235, etb: 110, bundle: 55, strategy: "High Demand 🔥" },
  "surging sparks": { box: 165, etb: 65, bundle: 65, strategy: "Medium Term 📈" },
  "ascended heroes": { box: 190, etb: 90, bundle: 60, strategy: "Medium Term 📈" },
  "destined rivals": { box: 165, etb: 85, bundle: 75, strategy: "Medium Term 📈" },
  "perfect order": { box: 145, etb: 50, bundle: 28, strategy: "Short Term ⏱️" }
};

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product, .item, .product-wrap, .product-grid-item, .product-block").each((_, el) => {
    const element = $(el);
    const title = element.find("h2, h3, h4, .product-title, .title, .name, .heading").first().text().trim();
    const priceText = element.find("[class*='price'], .amount, .money, .price-new, .current-price").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = element.find("a[href]").first().attr("href");
    
    const text = element.text().toLowerCase();
    const isOOS = text.includes("sold out") || text.includes("out of stock") || text.includes("stock: 0") || text.includes("not available");

    if (title && price > 5 && link && !isOOS) {
      const url = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url });
    }
  });
  return items;
}

const RETAILERS = [
  // Tier 1: Large Volume
  "https://www.magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://www.totalcards.net", 
  "https://www.zatu.co.uk", "https://www.waylandgames.co.uk", "https://www.cardmarket.com",
  // Tier 2: Mid-Size
  "https://japan2uk.com", "https://thecardvault.co.uk", "https://doublesleeved.co.uk", 
  "https://mytcg.co.uk", "https://hillscards.co.uk", "https://cosmiccollectables.co.uk",
  "https://thepokecave.co.uk", "https://geeky-zone.com", "https://brotherhoodgames.co.uk",
  // Tier 3: Specialized/Smaller
  "https://gatheringgames.co.uk", "https://pokemonplug.com", "https://pokestation.co.uk",
  "https://tcg-player.co.uk", "https://thecardpost.co.uk", "https://cardbot.co.uk",
  "https://titancards.co.uk", "https://7thcitycollectables.com", "https://bigorbitcards.co.uk",
  "https://dark-sphere.co.uk", "https://leisuregames.com", "https://thegamesmatrix.co.uk",
  "https://waterstones.com/category/toys-games/pokemon"
];

const QUERIES = ["pokemon+chaos+rising", "pokemon+151", "pokemon+prismatic+evolutions", "pokemon+sealed+case", "pokemon+booster+box"];

async function run() {
  console.log(`📡 SCANNING 28 RETAILERS ACROSS THE UK...`);
  const notified = new Set();

  for (const base of RETAILERS) {
    for (const q of QUERIES) {
      for (let page = 1; page <= 4; page++) {
        const url = `${base}/search?q=${q}&page=${page}`;
        const html = await fetchPage(url);
        if (!html) break;

        const items = extract(html, base);
        if (items.length === 0) break;

        for (const item of items) {
          // Analysis logic here (using previously established getAnalysis function)
          // Pinging Telegram for deals > £2.00 profit
        }
        await wait(600); // Fast but respectful
      }
    }
  }
}

run().then(() => process.exit(0));
