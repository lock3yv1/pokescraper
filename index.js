const axios = require("axios");
const cheerio = require("cheerio");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49,
  "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99,
  "build and battle": 24.99, "pin collection": 34.99,
  "deluxe pin collection": 34.99, "premier deck": 49.99,
  "ultra premium collection": 119.99, "league battle deck": 39.99,
  "tin": 24.99, "blister": 12.99,
};

const RESELL = {
  "ascended heroes elite trainer box": 65, "ascended heroes booster bundle": 38,
  "ascended heroes half box": 95, "ascended heroes booster pack": 6.50,
  "destined rivals booster box": 130, "destined rivals elite trainer box": 58,
  "destined rivals booster bundle": 32, "destined rivals booster pack": 5.50,
  "perfect order booster box": 160, "perfect order elite trainer box": 60,
  "perfect order booster pack": 7.00,
  "chaos rising booster box": 190, "chaos rising elite trainer box": 70,
  "chaos rising booster pack": 8.00,
  "phantasmal flames booster box": 280, "phantasmal flames elite trainer box": 90,
  "phantasmal flames booster pack": 12.00,
  "journey together booster box": 120, "journey together elite trainer box": 52,
  "journey together booster bundle": 28, "journey together booster pack": 5.00,
  "prismatic evolutions booster box": 220, "prismatic evolutions booster bundle": 90,
  "prismatic evolutions elite trainer box": 95, "prismatic evolutions booster pack": 18.00,
  "surging sparks booster box": 155, "surging sparks elite trainer box": 60,
  "surging sparks booster bundle": 35, "surging sparks booster pack": 6.50,
  "stellar crown booster box": 190, "stellar crown elite trainer box": 65,
  "shrouded fable booster box": 110, "twilight masquerade booster box": 130,
  "twilight masquerade elite trainer box": 55,
  "temporal forces booster box": 115, "temporal forces elite trainer box": 52,
  "paradox rift booster box": 120, "paradox rift elite trainer box": 55,
  "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58,
  "paldea evolved booster box": 100, "paldean fates booster box": 140,
  "151 booster box": 180, "151 booster bundle": 55,
  "151 elite trainer box": 70, "151 booster pack": 8.00,
  "evolving skies booster box": 800, "evolving skies elite trainer box": 180,
  "evolving skies booster pack": 28.00,
  "brilliant stars booster box": 150, "fusion strike booster box": 145,
  "lost origin booster box": 130, "silver tempest booster box": 125,
  "crown zenith booster box": 140, "chilling reign booster box": 160,
  "battle styles booster box": 180, "shining fates booster box": 250,
  "vivid voltage booster box": 150, "darkness ablaze booster box": 140,
  "hidden fates booster box": 400, "hidden fates elite trainer box": 120,
  "hidden fates booster pack": 15.00,
  "cosmic eclipse booster box": 350,
};

const PRODUCT_KEYWORDS = [
  "booster box","elite trainer box","etb","half box","booster bundle",
  "booster pack","collection box","poster collection","build and battle",
  "pin collection","premier deck","mini tins","ultra premium collection",
  "league battle deck","tin","blister",
];

const EXCLUDE = [
  "yugioh","yu-gi-oh","magic the gathering","mtg","digimon","one piece",
  "dragon ball","lorcana","cardfight","vanguard","weiss","buddyfight",
  "single","graded","psa","bgs","cgc","lot of","proxy","fake",
  "sleeve","playmat","binder","dice","coin","bulk","funko","plush","figure",
];

const SETS = [
  "ascended heroes","destined rivals","perfect order","chaos rising",
  "phantasmal flames","journey together","prismatic evolutions",
  "surging sparks","stellar crown","shrouded fable","twilight masquerade",
  "temporal forces","paradox rift","obsidian flames","paldea evolved",
  "paldean fates","151","evolving skies","brilliant stars","fusion strike",
  "lost origin","silver tempest","crown zenith","chilling reign",
  "battle styles","shining fates","hidden fates","vivid voltage",
  "darkness ablaze","cosmic eclipse",
];

function isValid(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  if (!SETS.some(s => t.includes(s))) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RRP).sort((a,b) => b[0].length - a[0].length);
  for (const [k,v] of sorted) if (t.includes(k)) return v;
  return null;
}

function getResell(title) {
  const t = title.toLowerCase();
  const sorted = Object.entries(RESELL).sort((a,b) => b[0].length - a[0].length);
  for (const [k,v] of sorted) if (t.includes(k)) return v;
  return null;
}

function dealScore(buy, rrp) {
  const d = ((buy-rrp)/rrp)*100;
  if (d<=-15) return "🔥 EXCELLENT DEAL";
  if (d<=-5)  return "✅ GOOD DEAL";
  if (d<=5)   return "⚖️ FAIR PRICE";
  if (d<=20)  return "⚠️ SLIGHTLY OVERPRICED";
  return "❌ OVERPRICED";
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

// Each retailer has ONE category URL — scrape once, get all products
const RETAILERS = [
  {
    name: "Total Cards",
    // Scrape their Pokemon booster boxes category directly
    pages: [
      "https://totalcards.net/collections/pokemon-booster-boxes",
      "https://totalcards.net/collections/pokemon-booster-packs",
    ],
    parse: ($, base) => {
      const items = [];
      $(".product-item, .grid__item, .product-card").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .product-item__title, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://totalcards.net${link}` });
      });
      return items;
    }
  },
  {
    name: "Titan Cards",
    pages: ["https://titancards.co.uk/collections/pokemon-sealed-products"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://titancards.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Magic Madhouse",
    pages: ["https://magicmadhouse.co.uk/pokemon/sealed-product/booster-boxes", "https://magicmadhouse.co.uk/pokemon/sealed-product/booster-packs"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .product-listing, .product").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .product-name, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: link.startsWith("http") ? link : `https://magicmadhouse.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Chaos Cards",
    pages: ["https://www.chaoscards.co.uk/shop/card-games/pokemon/pokemon-booster-boxes", "https://www.chaoscards.co.uk/shop/card-games/pokemon/pokemon-booster-packs"],
    parse: ($, base) => {
      const items = [];
      $(".product-item, .product-card, .product").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .product-title, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && link) items.push({ title, price, url: link.startsWith("http") ? link : `https://www.chaoscards.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Eterna Cards",
    pages: ["https://eternacards.co.uk/collections/pokemon-tcg-sealed-products"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://eternacards.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "PACKRAT",
    pages: ["https://packratt.co.uk/collections/pokemon"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://packratt.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Big Orbit",
    pages: ["https://www.bigorbitcards.co.uk/collections/pokemon-sealed"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://www.bigorbitcards.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Double Sleeved",
    pages: ["https://doublesleeved.co.uk/collections/pokemon"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://doublesleeved.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Toys N Geek",
    pages: ["https://www.toysngeek.co.uk/collections/pokemon"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper, .product-item").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading, .product-item__title").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://www.toysngeek.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "The Card Vault",
    pages: ["https://thecardvault.co.uk/collections/pokemon-tcg-sealed-products"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://thecardvault.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "My TCG",
    pages: ["https://mytcg.co.uk/collections/pokemon"],
    parse: ($, base) => {
      const items = [];
      $(".product-card, .grid__item, .card-wrapper").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .card__heading").first().text().trim();
        const priceText = $(el).find(".price, .price__regular").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://mytcg.co.uk${link}` });
      });
      return items;
    }
  },
  {
    name: "Smyths",
    pages: ["https://www.smythstoys.com/uk/en-gb/trading-cards/pokemon-cards/c/SM070301"],
    parse: ($, base) => {
      const items = [];
      $(".product-grid-item, .product-card, .product").each((_, el) => {
        const title = $(el).find("h2, h3, h4, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .js-priceValue").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price) items.push({ title, price, url: link || "https://www.smythstoys.com" });
      });
      return items;
    }
  },
  {
    name: "Argos",
    pages: ["https://www.argos.co.uk/search/pokemon-trading-cards/"],
    parse: ($, base) => {
      const items = [];
      $("[data-test='component-product-card']").each((_, el) => {
        const title = $(el).find("[data-test='product-title'], h3").first().text().trim();
        const priceText = $(el).find("[data-test='price']").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock");
        if (title && !soldOut && price && link) items.push({ title, price, url: `https://www.argos.co.uk${link}` });
      });
      return items;
    }
  },
];

const notified = new Set();

async function fetchPage(url) {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 12000,
    });
    return res.data;
  } catch (e) {
    console.log(`  ⏭ Skipped ${url.split("/")[2]}: ${e.message.slice(0,50)}`);
    return null;
  }
}

async function sendTelegram(msg) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: false,
    });
    console.log("  📱 Alert sent!");
  } catch (e) {
    console.log("  ❌ Telegram:", e.message);
  }
}

async function runScan() {
  console.log(`\n🔍 Scanning ${RETAILERS.length} retailers · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  for (const retailer of RETAILERS) {
    console.log(`  → ${retailer.name}`);
    for (const pageUrl of retailer.pages) {
      const html = await fetchPage(pageUrl);
      if (!html) continue;

      const $ = cheerio.load(html);
      const items = retailer.parse($, pageUrl);

      for (const item of items) {
        if (!isValid(item.title)) continue;

        const rrp = getRRP(item.title);
        const resell = getResell(item.title);
        if (!rrp || !resell) continue;

        const key = `${retailer.name}::${item.url}`;
        if (!notified.has(key)) {
          notified.add(key);
          findings.push({ ...item, retailer: retailer.name, rrp, resell });
          console.log(`    🟢 ${item.title} — £${item.price}`);
        }
      }
    }
  }

  console.log(`\n📊 Found ${findings.length} new confirmed items`);

  for (const f of findings) {
    const score = dealScore(f.price, f.rrp);
    const vsRrp = Math.round(((f.price-f.rrp)/f.rrp)*100);
    const vsResell = Math.round(((f.resell-f.price)/f.price)*100);
    const flipProfit = (f.resell - f.price - (f.resell*0.13) - 4).toFixed(2);

    const msg = [
      score, ``,
      `<b>${f.title}</b>`,
      `🏪 ${f.retailer}`, ``,
      `💰 BUY NOW:  £${f.price.toFixed(2)}`,
      `📊 RRP:      £${f.rrp.toFixed(2)}  (${vsRrp>0?"+":""}${vsRrp}% vs RRP)`,
      `📈 RESELL:   £${f.resell.toFixed(2)}  (${vsResell>0?"+":""}${vsResell}% potential)`,
      `🏷️ FLIP:     ${flipProfit>0?"+":""}£${flipProfit} after eBay fees`, ``,
      `<a href="${f.url}">👉 BUY NOW →</a>`,
    ].join("\n");

    await sendTelegram(msg);
    await new Promise(r => setTimeout(r, 300));
  }

  if (findings.length === 0) console.log("  ⬜ No new confirmed findings.");
}

console.log("🚀 Lock3y's PokéScraper — Category Mode");
console.log("📦 Scrapes category pages — faster & more reliable\n");

runScan()
  .then(() => { console.log("\n✅ Done."); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
