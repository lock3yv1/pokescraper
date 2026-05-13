const axios = require("axios");
const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── RRP (Official Pokemon retail prices) ──────────────────────────────────
const RRP = {
  "booster box": 144.99,
  "elite trainer box": 49.99,
  "etb": 49.99,
  "half box": 74.99,
  "booster bundle": 24.99,
  "booster pack": 4.49,
  "mini tins": 44.99,
  "collection box": 34.99,
  "poster collection": 19.99,
  "build and battle": 24.99,
  "build & battle": 24.99,
  "pin collection": 34.99,
  "deluxe pin collection": 34.99,
  "premier deck": 49.99,
  "display box": 299.99,
  "league battle deck": 39.99,
  "premium collection": 49.99,
  "ultra premium collection": 119.99,
  "upc": 119.99,
  "tin": 24.99,
  "blister": 12.99,
  "3 pack blister": 14.99,
  "check lane blister": 12.99,
};

// ─── RESELL PRICES (eBay UK current sold listings) ─────────────────────────
const RESELL = {
  // Mega Evolution era
  "ascended heroes elite trainer box": 65,
  "ascended heroes etb": 65,
  "ascended heroes booster bundle": 38,
  "ascended heroes half box": 95,
  "ascended heroes collection box": 45,
  "ascended heroes booster pack": 6.50,
  "destined rivals booster box": 130,
  "destined rivals elite trainer box": 58,
  "destined rivals booster bundle": 32,
  "destined rivals half box": 80,
  "destined rivals booster pack": 5.50,
  "perfect order booster box": 160,
  "perfect order elite trainer box": 60,
  "perfect order booster pack": 7.00,
  "chaos rising booster box": 190,
  "chaos rising elite trainer box": 70,
  "phantasmal flames booster box": 280,
  "phantasmal flames elite trainer box": 90,
  "phantasmal flames booster pack": 12.00,
  // Scarlet & Violet era
  "journey together booster box": 120,
  "journey together elite trainer box": 52,
  "journey together booster bundle": 28,
  "journey together booster pack": 5.00,
  "prismatic evolutions booster box": 220,
  "prismatic evolutions booster bundle": 90,
  "prismatic evolutions elite trainer box": 95,
  "prismatic evolutions booster pack": 18.00,
  "surging sparks booster box": 155,
  "surging sparks elite trainer box": 60,
  "surging sparks booster bundle": 35,
  "surging sparks booster pack": 6.50,
  "stellar crown booster box": 190,
  "stellar crown elite trainer box": 65,
  "stellar crown booster pack": 7.50,
  "shrouded fable booster box": 110,
  "shrouded fable booster pack": 5.00,
  "twilight masquerade booster box": 130,
  "twilight masquerade elite trainer box": 55,
  "twilight masquerade booster pack": 5.50,
  "temporal forces booster box": 115,
  "temporal forces elite trainer box": 52,
  "temporal forces booster pack": 5.00,
  "paradox rift booster box": 120,
  "paradox rift elite trainer box": 55,
  "paradox rift booster pack": 5.00,
  "obsidian flames booster box": 130,
  "obsidian flames elite trainer box": 58,
  "obsidian flames booster pack": 5.50,
  "paldea evolved booster box": 100,
  "paldea evolved booster pack": 4.50,
  "paldean fates booster box": 140,
  "paldean fates booster pack": 6.00,
  "151 booster box": 180,
  "151 booster bundle": 55,
  "151 elite trainer box": 70,
  "151 booster pack": 8.00,
  // Sword & Shield era
  "evolving skies booster box": 800,
  "evolving skies elite trainer box": 180,
  "evolving skies booster pack": 28.00,
  "brilliant stars booster box": 150,
  "brilliant stars booster pack": 6.00,
  "fusion strike booster box": 145,
  "fusion strike booster pack": 5.50,
  "lost origin booster box": 130,
  "lost origin booster pack": 5.50,
  "silver tempest booster box": 125,
  "silver tempest booster pack": 5.00,
  "crown zenith booster box": 140,
  "crown zenith booster pack": 5.50,
  "astral radiance booster box": 130,
  "astral radiance booster pack": 5.50,
  "chilling reign booster box": 160,
  "chilling reign booster pack": 6.50,
  "battle styles booster box": 180,
  "battle styles booster pack": 7.00,
  "shining fates booster box": 250,
  "shining fates booster pack": 10.00,
  "vivid voltage booster box": 150,
  "vivid voltage booster pack": 6.00,
  "darkness ablaze booster box": 140,
  "darkness ablaze booster pack": 5.50,
  "hidden fates booster box": 400,
  "hidden fates elite trainer box": 120,
  "hidden fates booster pack": 15.00,
  "champion path elite trainer box": 200,
  "cosmic eclipse booster box": 350,
  "cosmic eclipse booster pack": 14.00,
};

// ─── PRODUCT KEYWORDS (must contain one of these) ──────────────────────────
const PRODUCT_KEYWORDS = [
  "booster box",
  "elite trainer box",
  "etb",
  "half box",
  "booster bundle",
  "booster pack",
  "collection box",
  "poster collection",
  "build and battle",
  "build & battle",
  "pin collection",
  "deluxe pin collection",
  "premier deck",
  "display box",
  "mini tins",
  "ultra premium collection",
  "upc",
  "premium collection",
  "league battle deck",
  "tin",
  "blister",
  "check lane",
];

// ─── EXCLUDE if title contains these ──────────────────────────────────────
const EXCLUDE_KEYWORDS = [
  "yugioh", "yu-gi-oh", "magic the gathering", "mtg", "digimon",
  "one piece", "dragon ball", "lorcana", "flesh and blood",
  "cardfight", "vanguard", "weiss", "buddyfight", "gundam",
  "star wars", "disney", "marvel", "naruto",
  "single", "graded", "psa", "bgs", "cgc",
  "lot of", "proxy", "fake", "replica",
  "sleeve", "sleeves", "deck box", "playmat", "binder",
  "dice", "coin", "energy cards", "card lot", "bulk",
  "funko", "plush", "figure", "toy",
];

function isPokemonProduct(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE_KEYWORDS.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  for (const [key, price] of Object.entries(RRP)) {
    if (t.includes(key)) return price;
  }
  return null;
}

function getResell(title) {
  const t = title.toLowerCase();
  // Try longest match first for accuracy
  const sorted = Object.entries(RESELL).sort((a, b) => b[0].length - a[0].length);
  for (const [key, price] of sorted) {
    if (t.includes(key)) return price;
  }
  return null;
}

function getDealScore(buyNow, rrp) {
  const diff = ((buyNow - rrp) / rrp) * 100;
  if (diff <= -15) return "excellent";
  if (diff <= -5)  return "good";
  if (diff <= 5)   return "fair";
  if (diff <= 20)  return "slightly";
  return "overpriced";
}

const SCORE_LABELS = {
  excellent:  "🔥 EXCELLENT DEAL",
  good:       "✅ GOOD DEAL",
  fair:       "⚖️ FAIR PRICE",
  slightly:   "⚠️ SLIGHTLY OVERPRICED",
  overpriced: "❌ OVERPRICED",
};

// ─── SEARCH TERMS ──────────────────────────────────────────────────────────
const SEARCH_TERMS = [
  // Current Mega Evolution sets
  "pokemon tcg ascended heroes",
  "pokemon tcg destined rivals",
  "pokemon tcg perfect order",
  "pokemon tcg chaos rising",
  "pokemon tcg phantasmal flames",
  // Scarlet & Violet
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
  "pokemon tcg 151",
  "pokemon tcg paldean fates",
  // Sword & Shield
  "pokemon tcg evolving skies",
  "pokemon tcg brilliant stars",
  "pokemon tcg fusion strike",
  "pokemon tcg lost origin",
  "pokemon tcg silver tempest",
  "pokemon tcg crown zenith",
  "pokemon tcg astral radiance",
  "pokemon tcg chilling reign",
  "pokemon tcg battle styles",
  "pokemon tcg shining fates",
  "pokemon tcg hidden fates",
  "pokemon tcg vivid voltage",
  "pokemon tcg darkness ablaze",
  "pokemon tcg champion path",
  "pokemon tcg cosmic eclipse",
];

// ─── RETAILERS ─────────────────────────────────────────────────────────────
const RETAILERS = [
  {
    name: "Total Cards",
    searchUrl: (q) => `https://totalcards.net/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-item, .grid__item").each((_, el) => {
        const title = $(el).find(".product-item__title, h3, h4").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) items.push({ title, price, url: `https://totalcards.net${link}` });
      });
      return items;
    },
  },
  {
    name: "Titan Cards",
    searchUrl: (q) => `https://titancards.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-card__title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: `https://titancards.co.uk${link}` });
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
        const title = $(el).find("h3, h4, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: `https://magicmadhouse.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.chaoscards.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://eternacards.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://packratt.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.japan2uk.com${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.bigorbitcards.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://doublesleeved.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: link || null });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.argos.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.game.co.uk${link}` });
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
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.amazon.co.uk${link}` });
      });
      return items;
    },
  },
  {
    name: "Toys N Geek",
    searchUrl: (q) => `https://www.toysngeek.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading, .product-title, .product-item__title").first().text().trim();
        const priceText = $(el).find(".price, .price__regular, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) items.push({ title, price, url: `https://www.toysngeek.co.uk${link}` });
      });
      return items;
    },
  },
  {
    name: "The Card Vault",
    searchUrl: (q) => `https://thecardvault.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: `https://thecardvault.co.uk${link}` });
      });
      return items;
    },
  },
  {
    name: "My TCG",
    searchUrl: (q) => `https://mytcg.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: `https://mytcg.co.uk${link}` });
      });
      return items;
    },
  },
  {
    name: "Forbidden Planet",
    searchUrl: (q) => `https://forbiddenplanet.com/search/?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-list-item, .product-card, article").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: link?.startsWith("http") ? link : `https://forbiddenplanet.com${link}` });
      });
      return items;
    },
  },
  {
    name: "Gathering Games",
    searchUrl: (q) => `https://gatheringgames.co.uk/search?q=${encodeURIComponent(q)}&type=product`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) items.push({ title, price, url: `https://gatheringgames.co.uk${link}` });
      });
      return items;
    },
  },
  {
    name: "John Lewis",
    searchUrl: (q) => `https://www.johnlewis.com/search?search-term=${encodeURIComponent(q + " pokemon")}`,
    parseResults: ($) => {
      const items = [];
      $("[data-test='product-card'], .c-product-card").each((_, el) => {
        const title = $(el).find("h2, h3, [data-test='product-title']").first().text().trim();
        const priceText = $(el).find("[data-test='price-value'], .price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) items.push({ title, price, url: link?.startsWith("http") ? link : `https://www.johnlewis.com${link}` });
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
    console.log("  📱 Telegram sent!");
  } catch (e) {
    console.log("  ❌ Telegram error:", e.message);
  }
}

async function scrapeRetailer(retailer, term) {
  try {
    const res = await axios.get(retailer.searchUrl(term), { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    return retailer.parseResults($).filter(r => isPokemonProduct(r.title));
  } catch (e) {
    console.log(`  [${retailer.name}] Error: ${e.message}`);
    return [];
  }
}

async function runScan() {
  console.log(`\n🔍 Scanning ${RETAILERS.length} retailers · ${SEARCH_TERMS.length} sets · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const term of SEARCH_TERMS) {
    for (const retailer of RETAILERS) {
      const results = await scrapeRetailer(retailer, term);
      for (const r of results) {
        const rrp = getRRP(r.title);
        const resell = getResell(r.title);

        // Only alert when we have full price data
        if (!rrp || !resell) {
          console.log(`  ⚪ SKIPPED (no price data): [${retailer.name}] ${r.title}`);
          continue;
        }

        const key = `${retailer.name}::${r.url || r.title}`;
        if (!notifiedUrls.has(key)) {
          notifiedUrls.add(key);
          findings.push({ retailer: retailer.name, rrp, resell, ...r });
          console.log(`  🟢 [${retailer.name}] ${r.title} — £${r.price}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Send Telegram for each finding
  for (const f of findings) {
    const score = getDealScore(f.price, f.rrp);
    const vsRrp = Math.round(((f.price - f.rrp) / f.rrp) * 100);
    const vsResell = Math.round(((f.resell - f.price) / f.price) * 100);
    const flipProfit = (f.resell - f.price - (f.resell * 0.13) - 4).toFixed(2);
    const profitLabel = flipProfit > 0 ? `+£${flipProfit} profit` : `£${Math.abs(flipProfit)} loss`;

    const msg = [
      SCORE_LABELS[score],
      ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`,
      ``,
      `💰 BUY NOW:  £${f.price.toFixed(2)}`,
      `📊 RRP:      £${f.rrp.toFixed(2)}  (${vsRrp > 0 ? "+" : ""}${vsRrp}% vs RRP)`,
      `📈 RESELL:   £${f.resell.toFixed(2)}  (${vsResell > 0 ? "+" : ""}${vsResell}% potential)`,
      `🏷️ FLIP:     ${profitLabel} after eBay fees`,
      ``,
      `<a href="${f.url}">👉 BUY NOW →</a>`,
    ].join("\n");

    await sendTelegram(msg);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (findings.length === 0) {
    console.log("  ⬜ No new confirmed findings this scan.");
  } else {
    console.log(`\n  ✅ Sent ${findings.length} Telegram alert(s).`);
  }
}

// Run once and exit cleanly — GitHub Actions handles the scheduling
console.log("🚀 Lock3y's PokéScraper");
console.log(`🏪 ${RETAILERS.length} retailers · ${SEARCH_TERMS.length} sets`);
console.log(`📦 Booster boxes, ETBs, bundles, packs + more`);
console.log(`✅ Only alerts with confirmed RRP + Resell data\n`);

runScan().then(() => {
  console.log("\n✅ Scan complete. Exiting.");
  process.exit(0);
}).catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
