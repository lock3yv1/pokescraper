const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL = "*/10 * * * *";

// ─── RRP (Official Pokemon retail price) ──────────────────────────────────
const RRP = {
  "booster box": 144.99,
  "elite trainer box": 49.99,
  "etb": 49.99,
  "half box": 74.99,
  "booster bundle": 24.99,
  "booster pack": 4.49,
  "mini tin": 8.99,
  "mini tins": 44.99,
  "collection box": 34.99,
  "poster collection": 19.99,
  "build and battle": 24.99,
  "build & battle": 24.99,
  "pin collection": 34.99,
  "deluxe pin": 34.99,
  "premier deck": 49.99,
  "ex box": 19.99,
  "tin": 24.99,
  "blister": 12.99,
  "3 pack": 14.99,
  "display box": 299.99,
};

// ─── RESELL PRICES (eBay UK current sold listings) ─────────────────────────
// Per product type: booster box resell prices
const RESELL = {
  // Mega Evolution era
  "ascended heroes booster box": 165,
  "ascended heroes elite trainer box": 65,
  "ascended heroes etb": 65,
  "ascended heroes booster bundle": 38,
  "ascended heroes half box": 95,
  "destined rivals booster box": 130,
  "destined rivals elite trainer box": 58,
  "destined rivals etb": 58,
  "destined rivals booster bundle": 32,
  "destined rivals half box": 80,
  // Scarlet & Violet era
  "journey together booster box": 120,
  "journey together elite trainer box": 52,
  "prismatic evolutions booster box": 220,
  "prismatic evolutions booster bundle": 90,
  "surging sparks booster box": 155,
  "surging sparks elite trainer box": 60,
  "stellar crown booster box": 190,
  "shrouded fable booster box": 110,
  "twilight masquerade booster box": 130,
  "temporal forces booster box": 115,
  "paradox rift booster box": 120,
  "obsidian flames booster box": 130,
  "paldea evolved booster box": 100,
  "scarlet violet booster box": 110,
  "paldean fates booster box": 140,
  "151 booster box": 180,
  "151 booster bundle": 55,
  "perfect order booster box": 160,
  // Sword & Shield era
  "evolving skies booster box": 800,
  "brilliant stars booster box": 150,
  "fusion strike booster box": 145,
  "lost origin booster box": 130,
  "silver tempest booster box": 125,
  "crown zenith booster box": 140,
  "astral radiance booster box": 130,
  "chilling reign booster box": 160,
  "battle styles booster box": 180,
  "shining fates booster box": 250,
  "vivid voltage booster box": 150,
  "darkness ablaze booster box": 140,
  "hidden fates booster box": 400,
};

function getResell(title) {
  const t = title.toLowerCase();
  for (const [key, price] of Object.entries(RESELL)) {
    if (t.includes(key.split(" ").slice(0, 3).join(" "))) return price;
  }
  return null;
}

function getRRP(title) {
  const t = title.toLowerCase();
  for (const [key, price] of Object.entries(RRP)) {
    if (t.includes(key)) return price;
  }
  return null;
}

function getDealScore(buyNow, rrp) {
  if (!rrp) return "unknown";
  const diff = ((buyNow - rrp) / rrp) * 100;
  if (diff <= -15) return "excellent";
  if (diff <= -5)  return "good";
  if (diff <= 5)   return "fair";
  if (diff <= 20)  return "slightly";
  return "overpriced";
}

// ─── ALL ENGLISH POKEMON SETS ──────────────────────────────────────────────
// NOTE: Every query includes "pokemon tcg" to avoid other card games
const SEARCH_TERMS = [
  "pokemon tcg ascended heroes",
  "pokemon tcg destined rivals",
  "pokemon tcg journey together",
  "pokemon tcg prismatic evolutions",
  "pokemon tcg surging sparks",
  "pokemon tcg stellar crown",
  "pokemon tcg shrouded fable",
  "pokemon tcg twilight masquerade",
  "pokemon tcg temporal forces",
  "pokemon tcg paradox rift",
  "pokemon tcg obsidian flames",
  "pokemon tcg paldea evolved",
  "pokemon tcg scarlet violet base set",
  "pokemon tcg 151",
  "pokemon tcg paldean fates",
  "pokemon tcg perfect order",
  "pokemon tcg black bolt",
  "pokemon tcg white flare",
  "pokemon tcg lost origin",
  "pokemon tcg silver tempest",
  "pokemon tcg crown zenith",
  "pokemon tcg astral radiance",
  "pokemon tcg brilliant stars",
  "pokemon tcg fusion strike",
  "pokemon tcg evolving skies",
  "pokemon tcg chilling reign",
  "pokemon tcg battle styles",
  "pokemon tcg shining fates",
  "pokemon tcg vivid voltage",
  "pokemon tcg darkness ablaze",
  "pokemon tcg hidden fates",
];

// Keywords that confirm it's a Pokemon TCG product
const POKEMON_KEYWORDS = [
  "pokemon", "scarlet", "violet", "sword", "shield", "ascended", "destined",
  "prismatic", "surging", "stellar", "shrouded", "twilight", "temporal",
  "paradox", "obsidian", "paldea", "paldean", "evolving", "brilliant",
  "fusion", "chilling", "vivid", "darkness", "hidden", "silver tempest",
  "lost origin", "crown zenith", "astral", "journey together", "perfect order",
];

// Keywords that indicate it's NOT a Pokemon product
const EXCLUDE_KEYWORDS = [
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "flesh and blood", "weiss",
  "cardfight", "vanguard", "buddyfight", "force of will",
];

function isPokemonProduct(title) {
  const t = title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some(k => t.includes(k))) return false;
  return POKEMON_KEYWORDS.some(k => t.includes(k));
}

// ─── RETAILERS ─────────────────────────────────────────────────────────────
const RETAILERS = [
  {
    name: "Total Cards",
    searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-item, .grid__item, [data-product-handle]").each((_, el) => {
        const title = $(el).find(".product-item__title, .grid-product__title, h3, h4").first().text().trim();
        const priceText = $(el).find(".price, .product-price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://totalcards.net${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Titan Cards",
    searchUrl: (q) => `https://titancards.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-card__title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://titancards.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Magic Madhouse",
    searchUrl: (q) => `https://magicmadhouse.co.uk/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .product-listing").each((_, el) => {
        const title = $(el).find("h3, h4, .product-name, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://magicmadhouse.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Chaos Cards",
    searchUrl: (q) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-item, .product-card").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.chaoscards.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Eterna Cards",
    searchUrl: (q) => `https://eternacards.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://eternacards.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "PACKRAT",
    searchUrl: (q) => `https://packratt.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://packratt.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Japan2UK",
    searchUrl: (q) => `https://www.japan2uk.com/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.japan2uk.com${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Big Orbit",
    searchUrl: (q) => `https://www.bigorbitcards.co.uk/search?type=product&q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.bigorbitcards.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Double Sleeved",
    searchUrl: (q) => `https://doublesleeved.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://doublesleeved.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Smyths",
    searchUrl: (q) => `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-grid-item, .product-card").each((_, el) => {
        const title = $(el).find("h3, h4, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .js-priceValue").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: link || null });
        }
      });
      return items;
    },
  },
  {
    name: "Argos",
    searchUrl: (q) => `https://www.argos.co.uk/search/${encodeURIComponent(q)}/`,
    parseResults: ($) => {
      const items = [];
      $("[data-test='component-product-card']").each((_, el) => {
        const title = $(el).find("[data-test='product-title'], h3").first().text().trim();
        const priceText = $(el).find("[data-test='price']").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.argos.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "GAME",
    searchUrl: (q) => `https://www.game.co.uk/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product, .product-card").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.game.co.uk${link}` });
        }
      });
      return items;
    },
  },
  {
    name: "Amazon UK",
    searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}&rh=p_85%3A1`,
    parseResults: ($) => {
      const items = [];
      $("[data-component-type='s-search-result']").each((_, el) => {
        const title = $(el).find("h2 a span").first().text().trim();
        const priceText = $(el).find(".a-price-whole").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("h2 a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("currently unavailable");
        if (title && !soldOut && price && isPokemonProduct(title)) {
          items.push({ title, price, url: `https://www.amazon.co.uk${link}` });
        }
      });
      return items;
    },
  },
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

const notifiedUrls = new Set();

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
}

async function scrapeRetailer(retailer, term) {
  try {
    const res = await axios.get(retailer.searchUrl(term), { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    return retailer.parseResults($);
  } catch (e) {
    console.log(`[${retailer.name}] Error: ${e.message}`);
    return [];
  }
}

async function runScan() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Scanning ${RETAILERS.length} retailers...`);
  const newFindings = [];

  for (const term of SEARCH_TERMS) {
    for (const retailer of RETAILERS) {
      const results = await scrapeRetailer(retailer, term);
      for (const r of results) {
        const key = `${retailer.name}::${r.url || r.title}`;
        if (!notifiedUrls.has(key)) {
          notifiedUrls.add(key);
          newFindings.push({ retailer: retailer.name, ...r });
          console.log(`  🟢 [${retailer.name}] ${r.title} — £${r.price}`);
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  for (const f of newFindings) {
    const rrp = getRRP(f.title);
    const resell = getResell(f.title);
    const score = getDealScore(f.price, rrp);

    const rrpLine = rrp
      ? `📊 RRP:       £${rrp.toFixed(2)}  (${f.price < rrp ? "-" : "+"}${Math.abs(Math.round(((f.price - rrp) / rrp) * 100))}% vs RRP)`
      : `📊 RRP:       No data`;

    const resellLine = resell
      ? `📈 RESELL:    £${resell.toFixed(2)}  (${resell > f.price ? "+" : ""}${Math.round(((resell - f.price) / f.price) * 100)}% ${resell > f.price ? "profit if flipped" : "loss if flipped"})`
      : `📈 RESELL:    No data`;

    const scoreLabels = {
      excellent: "🔥 EXCELLENT DEAL",
      good: "✅ GOOD DEAL",
      fair: "⚖️ FAIR PRICE",
      slightly: "⚠️ SLIGHTLY OVERPRICED",
      overpriced: "❌ OVERPRICED",
      unknown: "📦 IN STOCK",
    };

    const msg = [
      scoreLabels[score],
      ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`,
      ``,
      `💰 BUY NOW:  £${f.price.toFixed(2)}`,
      rrpLine,
      resellLine,
      ``,
      `<a href="${f.url}">👉 BUY NOW →</a>`,
    ].join("\n");

    await sendTelegram(msg);
    await new Promise(r => setTimeout(r, 500));
  }

  if (newFindings.length === 0) console.log("  ⬜ No new findings.");
}

console.log("🚀 Lock3y's PokéScraper");
console.log(`🏪 ${RETAILERS.length} retailers · ${SEARCH_TERMS.length} sets · Pokemon TCG only`);
console.log(`📊 3-way price comparison: Buy Now vs RRP vs Resell\n`);

runScan();
cron.schedule(CHECK_INTERVAL, runScan);
