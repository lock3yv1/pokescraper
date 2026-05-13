const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL = "*/10 * * * *";

// ─── RETAIL REFERENCE PRICES ───────────────────────────────────────────────
const RETAIL_PRICES = {
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
  "binder": 24.99,
  "playmat": 19.99,
  "display box": 299.99,
  "blister": 12.99,
  "3 pack": 14.99,
  "three pack": 14.99,
};

// ─── PRODUCTS TO WATCH ─────────────────────────────────────────────────────
const PRODUCTS = [
  "ascended heroes",
  "destined rivals",
  "journey together",
  "prismatic evolutions",
  "surging sparks",
  "stellar crown",
  "shrouded fable",
  "twilight masquerade",
  "temporal forces",
  "paradox rift",
  "obsidian flames",
  "paldea evolved",
  "scarlet violet base",
  "151",
  "lost origin",
  "silver tempest",
  "crown zenith",
  "paldean fates",
  "perfect order",
  "black bolt",
  "white flare",
];

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
        const soldOut = $(el).text().toLowerCase().includes("sold out") ||
                        $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://totalcards.net${link}` : null });
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
        const title = $(el).find("h3, h4, .product-card__title, .grid-product__title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://titancards.co.uk${link}` : null });
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
      $(".product-card, .product-listing, .search-result").each((_, el) => {
        const title = $(el).find("h3, h4, .product-name, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") ||
                        $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://magicmadhouse.co.uk${link}` : null });
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
      $(".product-item, .product-card, .grid-item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") ||
                        $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.chaoscards.co.uk${link}` : null });
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
      $(".product-card, .grid__item, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .card__heading, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://eternacards.co.uk${link}` : null });
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
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://packratt.co.uk${link}` : null });
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
      $(".product-card, .grid__item, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.japan2uk.com${link}` : null });
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
      $(".product-card, .grid__item, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.bigorbitcards.co.uk${link}` : null });
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
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://doublesleeved.co.uk${link}` : null });
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
        if (title && !soldOut && price) {
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
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.argos.co.uk${link}` : null });
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
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.game.co.uk${link}` : null });
        }
      });
      return items;
    },
  },
  {
    name: "Amazon UK",
    searchUrl: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q + " pokemon tcg")}&rh=p_85%3A1`,
    parseResults: ($) => {
      const items = [];
      $("[data-component-type='s-search-result']").each((_, el) => {
        const title = $(el).find("h2 a span").first().text().trim();
        const priceText = $(el).find(".a-price-whole").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("h2 a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("currently unavailable");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.amazon.co.uk${link}` : null });
        }
      });
      return items;
    },
  },
];

// ─── HEADERS ───────────────────────────────────────────────────────────────
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

const notifiedUrls = new Set();

// ─── PRICE COMPARISON ──────────────────────────────────────────────────────
function getRetailPrice(title) {
  const t = title.toLowerCase();
  for (const [key, price] of Object.entries(RETAIL_PRICES)) {
    if (t.includes(key)) return price;
  }
  return null;
}

function getDealInfo(price, retailPrice) {
  if (!retailPrice) return null;
  const diff = ((price - retailPrice) / retailPrice) * 100;
  const rounded = Math.round(diff);
  if (diff <= -15) return { label: "🔥 EXCELLENT DEAL", pct: rounded };
  if (diff <= -5)  return { label: "✅ GOOD DEAL", pct: rounded };
  if (diff <= 5)   return { label: "⚖️ FAIR PRICE", pct: rounded };
  if (diff <= 20)  return { label: "⚠️ SLIGHTLY OVERPRICED", pct: rounded };
  return { label: "❌ OVERPRICED", pct: rounded };
}

// ─── TELEGRAM ──────────────────────────────────────────────────────────────
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

// ─── SCRAPE ────────────────────────────────────────────────────────────────
async function scrapeRetailer(retailer, product) {
  try {
    const url = retailer.searchUrl(product);
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    return retailer.parseResults($).filter(r => {
      const t = r.title.toLowerCase();
      return PRODUCTS.some(p => t.includes(p.toLowerCase()));
    });
  } catch (e) {
    console.log(`[${retailer.name}] Error: ${e.message}`);
    return [];
  }
}

// ─── MAIN SCAN ─────────────────────────────────────────────────────────────
async function runScan() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Scanning ${RETAILERS.length} retailers...`);
  const allFindings = [];

  for (const product of PRODUCTS) {
    for (const retailer of RETAILERS) {
      const results = await scrapeRetailer(retailer, product);
      for (const r of results) {
        const key = `${retailer.name}::${r.url || r.title}`;
        if (!notifiedUrls.has(key)) {
          notifiedUrls.add(key);
          allFindings.push({ retailer: retailer.name, ...r });
          console.log(`  🟢 [${retailer.name}] ${r.title} — £${r.price}`);
        }
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  if (allFindings.length > 0) {
    for (const f of allFindings) {
      const retailPrice = getRetailPrice(f.title);
      const deal = retailPrice ? getDealInfo(f.price, retailPrice) : null;
      const pctStr = deal ? (deal.pct > 0 ? `+${deal.pct}%` : `${deal.pct}%`) : null;

      const msg = [
        deal ? deal.label : "📦 IN STOCK",
        ``,
        `<b>${f.title}</b>`,
        `🏪 ${f.retailer}`,
        `💰 Price: <b>£${f.price?.toFixed(2)}</b>`,
        retailPrice ? `📊 RRP: £${retailPrice.toFixed(2)}` : null,
        deal ? `📈 vs RRP: <b>${pctStr}</b>` : `📊 No RRP data for this product type`,
        ``,
        `<a href="${f.url}">👉 BUY NOW →</a>`,
      ].filter(Boolean).join("\n");

      await sendTelegram(msg);
      await new Promise(r => setTimeout(r, 500));
    }
  } else {
    console.log("  ⬜ Nothing new in stock.");
  }
}

// ─── START ─────────────────────────────────────────────────────────────────
console.log("🚀 Lock3y's PokéScraper");
console.log(`🏪 Checking ${RETAILERS.length} retailers every 10 minutes`);
console.log(`📋 Watching ${PRODUCTS.length} English Pokemon sets\n`);

runScan();
cron.schedule(CHECK_INTERVAL, runScan);
