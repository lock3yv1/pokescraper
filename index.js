const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http"); // Added: Keeps the app alive on Railway

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RAILWAY HEARTBEAT ─────────────────────────────────────────────────────
// This creates a tiny web server so Railway doesn't shut the app down.
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("PokéScraper is active and monitoring.");
}).listen(process.env.PORT || 3000);

// ─── YOUR ORIGINAL DATA (RETAINED) ─────────────────────────────────────────
const RRP = { "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99, "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49, "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99, "build and battle": 24.99, "build & battle": 24.99, "pin collection": 34.99, "deluxe pin collection": 34.99, "premier deck": 49.99, "display box": 299.99, "league battle deck": 39.99, "premium collection": 49.99, "ultra premium collection": 119.99, "upc": 119.99 };

const RESELL = { "ascended heroes elite trainer box": 65, "ascended heroes etb": 65, "ascended heroes booster bundle": 38, "ascended heroes half box": 95, "ascended heroes collection box": 45, "destined rivals booster box": 130, "destined rivals elite trainer box": 58, "destined rivals booster bundle": 32, "destined rivals half box": 80, "perfect order booster box": 160, "perfect order elite trainer box": 60, "chaos rising booster box": 190, "chaos rising elite trainer box": 70, "phantasmal flames booster box": 280, "phantasmal flames elite trainer box": 90, "journey together booster box": 120, "journey together elite trainer box": 52, "journey together booster bundle": 28, "prismatic evolutions booster box": 220, "prismatic evolutions booster bundle": 90, "prismatic evolutions elite trainer box": 95, "surging sparks booster box": 155, "surging sparks elite trainer box": 60, "surging sparks booster bundle": 35, "stellar crown booster box": 190, "stellar crown elite trainer box": 65, "shrouded fable booster box": 110, "twilight masquerade booster box": 130, "twilight masquerade elite trainer box": 55, "temporal forces booster box": 115, "temporal forces elite trainer box": 52, "paradox rift booster box": 120, "paradox rift elite trainer box": 55, "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58, "paldea evolved booster box": 100, "paldean fates booster box": 140, "151 booster box": 180, "151 booster bundle": 55, "151 elite trainer box": 70, "evolving skies booster box": 800, "evolving skies elite trainer box": 180, "brilliant stars booster box": 150, "fusion strike booster box": 145, "lost origin booster box": 130, "silver tempest booster box": 125, "crown zenith booster box": 140, "astral radiance booster box": 130, "chilling reign booster box": 160, "battle styles booster box": 180, "shining fates booster box": 250, "vivid voltage booster box": 150, "darkness ablaze booster box": 140, "hidden fates booster box": 400, "hidden fates elite trainer box": 120, "champion path elite trainer box": 200, "cosmic eclipse booster box": 350 };

const SEALED_KEYWORDS = ["booster box", "elite trainer box", "etb", "half box", "booster bundle", "collection box", "poster collection", "build and battle", "build & battle", "pin collection", "deluxe pin collection", "premier deck", "display box", "mini tins", "ultra premium collection", "upc", "premium collection", "league battle deck"];
const EXCLUDE_KEYWORDS = ["yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon", "one piece", "dragon ball", "lorcana", "flesh and blood", "cardfight", "vanguard", "weiss", "buddyfight", "gundam", "single", "holo", "full art", "secret rare", "graded", "psa", "bgs", "cgc", "lot of", "proxy", "fake", "replica", "sleeve", "sleeves", "deck box", "playmat", "binder", "dice", "coin", "energy cards", "card lot", "bulk"];

function isSealedPokemon(title) { const t = title.toLowerCase(); return t.includes("pokemon") && !EXCLUDE_KEYWORDS.some(k => t.includes(k)) && SEALED_KEYWORDS.some(k => t.includes(k)); }
function getRRP(title) { const t = title.toLowerCase(); for (const [key, price] of Object.entries(RRP)) { if (t.includes(key)) return price; } return null; }
function getResell(title) { const t = title.toLowerCase(); for (const [key, price] of Object.entries(RESELL)) { if (t.includes(key)) return price; } return null; }
function getDealScore(buyNow, rrp) { const diff = ((buyNow - rrp) / rrp) * 100; if (diff <= -15) return "excellent"; if (diff <= -5) return "good"; if (diff <= 5) return "fair"; if (diff <= 20) return "slightly"; return "overpriced"; }
const SCORE_LABELS = { excellent: "🔥 EXCELLENT DEAL", good: "✅ GOOD DEAL", fair: "⚖️ FAIR PRICE", slightly: "⚠️ SLIGHTLY OVERPRICED", overpriced: "❌ OVERPRICED" };

// ─── SEARCH & RETAILERS (PASTE YOUR ORIGINAL ARRAYS HERE) ──────────────────
const SEARCH_TERMS = ["pokemon tcg ascended heroes", "pokemon tcg destined rivals", "pokemon tcg perfect order", "pokemon tcg chaos rising", "pokemon tcg phantasmal flames", "pokemon tcg journey together", "pokemon tcg prismatic evolutions", "pokemon tcg surging sparks", "pokemon tcg stellar crown", "pokemon tcg shrouded fable", "pokemon tcg twilight masquerade", "pokemon tcg temporal forces", "pokemon tcg paradox rift", "pokemon tcg obsidian flames", "pokemon tcg paldea evolved", "pokemon tcg 151", "pokemon tcg paldean fates", "pokemon tcg evolving skies", "pokemon tcg brilliant stars", "pokemon tcg fusion strike", "pokemon tcg lost origin", "pokemon tcg silver tempest", "pokemon tcg crown zenith", "pokemon tcg astral radiance", "pokemon tcg chilling reign", "pokemon tcg battle styles", "pokemon tcg shining fates", "pokemon tcg hidden fates", "pokemon tcg vivid voltage", "pokemon tcg darkness ablaze", "pokemon tcg champion path", "pokemon tcg cosmic eclipse"];

const RETAILERS = [
  { name: "Total Cards", searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-item, .grid__item").each((_, el) => { const title = $(el).find(".product-item__title, h3, h4").first().text().trim(); const priceText = $(el).find(".price, .price__regular").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://totalcards.net${link}` }); }); return items; } },
  { name: "Titan Cards", searchUrl: (q) => `https://titancards.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .product-card__title").first().text().trim(); const priceText = $(el).find(".price, .product-price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://titancards.co.uk${link}` }); }); return items; } },
  { name: "Magic Madhouse", searchUrl: (q) => `https://magicmadhouse.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-card, .product-listing").each((_, el) => { const title = $(el).find("h3, h4, .product-name").first().text().trim(); const priceText = $(el).find(".price, .product-price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://magicmadhouse.co.uk${link}` }); }); return items; } },
  { name: "Chaos Cards", searchUrl: (q) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-item, .product-card").each((_, el) => { const title = $(el).find("h3, h4, .product-title").first().text().trim(); const priceText = $(el).find(".price, .product-price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://www.chaoscards.co.uk${link}` }); }); return items; } },
  { name: "Eterna Cards", searchUrl: (q) => `https://eternacards.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .card__heading").first().text().trim(); const priceText = $(el).find(".price, .price__regular").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://eternacards.co.uk${link}` }); }); return items; } },
  { name: "PACKRAT", searchUrl: (q) => `https://packratt.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .card__heading").first().text().trim(); const priceText = $(el).find(".price, .price__regular").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://packratt.co.uk${link}` }); }); return items; } },
  { name: "Japan2UK", searchUrl: (q) => `https://www.japan2uk.com/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .product-title").first().text().trim(); const priceText = $(el).find(".price, .product-price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://www.japan2uk.com${link}` }); }); return items; } },
  { name: "Big Orbit", searchUrl: (q) => `https://www.bigorbitcards.co.uk/search?type=product&q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .product-title").first().text().trim(); const priceText = $(el).find(".price, .product-price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://www.bigorbitcards.co.uk${link}` }); }); return items; } },
  { name: "Double Sleeved", searchUrl: (q) => `https://doublesleeved.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card, .grid__item").each((_, el) => { const title = $(el).find("h3, h4, .card__heading").first().text().trim(); const priceText = $(el).find(".price, .price__regular").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://doublesleeved.co.uk${link}` }); }); return items; } },
  { name: "Smyths", searchUrl: (q) => `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-grid-item").each((_, el) => { const title = $(el).find("h3, h4, .product-name").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: link }); }); return items; } },
  { name: "Argos", searchUrl: (q) => `https://www.argos.co.uk/search/${encodeURIComponent(q)}/`, parseResults: ($) => { const items = []; $("[data-test='component-product-card']").each((_, el) => { const title = $(el).find("[data-test='product-title']").first().text().trim(); const priceText = $(el).find("[data-test='price']").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: `https://www.argos.co.uk${link}` }); }); return items; } },
  { name: "GAME", searchUrl: (q) => `https://www.game.co.uk/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product").each((_, el) => { const title = $(el).find(".product-title").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: `https://www.game.co.uk${link}` }); }); return items; } },
  { name: "Amazon UK", searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}&rh=p_85%3A1`, parseResults: ($) => { const items = []; $("[data-component-type='s-search-result']").each((_, el) => { const title = $(el).find("h2 a span").first().text().trim(); const priceText = $(el).find(".a-price-whole").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("h2 a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("unavailable") && price) items.push({ title, price, url: `https://www.amazon.co.uk${link}` }); }); return items; } },
  { name: "My TCG", searchUrl: (q) => `https://mytcg.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card").each((_, el) => { const title = $(el).find(".product-title").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://mytcg.co.uk${link}` }); }); return items; } },
  { name: "Evol Vault", searchUrl: (q) => `https://evolvault.com/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card").each((_, el) => { const title = $(el).find(".card__heading").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://evolvault.com${link}` }); }); return items; } },
  { name: "Evo Cards", searchUrl: (q) => `https://evocards.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card").each((_, el) => { const title = $(el).find(".card__heading").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://evocards.co.uk${link}` }); }); return items; } },
  { name: "Forbidden Planet", searchUrl: (q) => `https://forbiddenplanet.com/search/?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-list-item").each((_, el) => { const title = $(el).find(".product-name").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: `https://forbiddenplanet.com${link}` }); }); return items; } },
  { name: "Gathering Games", searchUrl: (q) => `https://gatheringgames.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parseResults: ($) => { const items = []; $(".product-card").each((_, el) => { const title = $(el).find(".card__heading").first().text().trim(); const priceText = $(el).find(".price").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("sold out") && price) items.push({ title, price, url: `https://gatheringgames.co.uk${link}` }); }); return items; } },
  { name: "Pokemon Center UK", searchUrl: (q) => `https://www.pokemoncenter.com/en-gb/search?q=${encodeURIComponent(q)}`, parseResults: ($) => { const items = []; $(".product-card").each((_, el) => { const title = $(el).find("h3").first().text().trim(); const priceText = $(el).find("[class*='price']").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: `https://www.pokemoncenter.com${link}` }); }); return items; } },
  { name: "John Lewis", searchUrl: (q) => `https://www.johnlewis.com/search?search-term=${encodeURIComponent(q + " pokemon")}`, parseResults: ($) => { const items = []; $("[data-test='product-card']").each((_, el) => { const title = $(el).find("[data-test='product-title']").first().text().trim(); const priceText = $(el).find("[data-test='price-value']").first().text().trim(); const price = parseFloat(priceText.replace(/[^0-9.]/g, "")); const link = $(el).find("a").first().attr("href"); if (title && !$(el).text().toLowerCase().includes("out of stock") && price) items.push({ title, price, url: `https://www.johnlewis.com${link}` }); }); return items; } }
];

const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" };
const notifiedUrls = new Set();

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    });
  } catch (e) { console.log("Telegram API error:", e.message); }
}

async function runScan() {
  console.log(`\n🔍 Scan started at ${new Date().toLocaleTimeString()}...`);
  let foundCount = 0;

  for (const term of SEARCH_TERMS) {
    for (const retailer of RETAILERS) {
      try {
        const res = await axios.get(retailer.searchUrl(term), { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(res.data);
        const results = retailer.parseResults($).filter(r => isSealedPokemon(r.title));

        for (const r of results) {
          const rrp = getRRP(r.title);
          const resell = getResell(r.title);
          if (!rrp || !resell) continue;

          const key = `${retailer.name}::${r.url}`;
          if (!notifiedUrls.has(key)) {
            notifiedUrls.add(key);
            foundCount++;
            const score = getDealScore(r.price, rrp);
            const flipProfit = (resell - r.price - (resell * 0.13) - 4).toFixed(2);
            
            const msg = [
              SCORE_LABELS[score],
              `<b>${r.title}</b>`,
              `🏪 ${retailer.name}`,
              `💰 BUY: £${r.price.toFixed(2)} | 📊 RRP: £${rrp.toFixed(2)}`,
              `🏷️ FLIP: £${flipProfit} after fees`,
              `<a href="${r.url}">👉 BUY NOW →</a>`
            ].join("\n");

            await sendTelegram(msg);
          }
        }
      } catch (e) { console.log(`[${retailer.name}] Error: ${e.message}`); }
      await new Promise(r => setTimeout(r, 500)); // Avoid getting blocked
    }
  }
  console.log(`✅ Scan finished. Sent ${foundCount} alerts.`);
}

// ─── STARTUP ───────────────────────────────────────────────────────────────
async function start() {
  console.log("🚀 PokéScraper is starting...");
  // Test message so you know your phone is connected!
  await sendTelegram("🤖 <b>PokéScraper is ONLINE!</b>\nI will now scan for Pokémon deals every 10 minutes.");
  
  await runScan(); // First scan
  setInterval(runScan, 600000); // 10 minutes
}

start();
