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
  "premium collection": 49.99, "tin": 24.99, "blister": 12.99,
};

const RESELL = {
  "ascended heroes elite trainer box": 65, "ascended heroes booster bundle": 38,
  "ascended heroes half box": 95, "ascended heroes booster pack": 6.50,
  "destined rivals booster box": 130, "destined rivals elite trainer box": 58,
  "destined rivals booster bundle": 32, "destined rivals half box": 80,
  "destined rivals booster pack": 5.50,
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
  "stellar crown booster pack": 7.50,
  "shrouded fable booster box": 110, "shrouded fable booster pack": 5.00,
  "twilight masquerade booster box": 130, "twilight masquerade elite trainer box": 55,
  "twilight masquerade booster pack": 5.50,
  "temporal forces booster box": 115, "temporal forces elite trainer box": 52,
  "temporal forces booster pack": 5.00,
  "paradox rift booster box": 120, "paradox rift elite trainer box": 55,
  "paradox rift booster pack": 5.00,
  "obsidian flames booster box": 130, "obsidian flames elite trainer box": 58,
  "obsidian flames booster pack": 5.50,
  "paldea evolved booster box": 100, "paldea evolved booster pack": 4.50,
  "paldean fates booster box": 140, "paldean fates booster pack": 6.00,
  "151 booster box": 180, "151 booster bundle": 55,
  "151 elite trainer box": 70, "151 booster pack": 8.00,
  "evolving skies booster box": 800, "evolving skies elite trainer box": 180,
  "evolving skies booster pack": 28.00,
  "brilliant stars booster box": 150, "brilliant stars booster pack": 6.00,
  "fusion strike booster box": 145, "fusion strike booster pack": 5.50,
  "lost origin booster box": 130, "lost origin booster pack": 5.50,
  "silver tempest booster box": 125, "silver tempest booster pack": 5.00,
  "crown zenith booster box": 140, "crown zenith booster pack": 5.50,
  "astral radiance booster box": 130, "astral radiance booster pack": 5.50,
  "chilling reign booster box": 160, "chilling reign booster pack": 6.50,
  "battle styles booster box": 180, "battle styles booster pack": 7.00,
  "shining fates booster box": 250, "shining fates booster pack": 10.00,
  "vivid voltage booster box": 150, "vivid voltage booster pack": 6.00,
  "darkness ablaze booster box": 140, "darkness ablaze booster pack": 5.50,
  "hidden fates booster box": 400, "hidden fates elite trainer box": 120,
  "hidden fates booster pack": 15.00,
  "champion path elite trainer box": 200,
  "cosmic eclipse booster box": 350, "cosmic eclipse booster pack": 14.00,
};

const PRODUCT_KEYWORDS = [
  "booster box","elite trainer box","etb","half box","booster bundle",
  "booster pack","collection box","poster collection","build and battle",
  "pin collection","deluxe pin collection","premier deck","display box",
  "mini tins","ultra premium collection","league battle deck",
  "premium collection","tin","blister",
];

const EXCLUDE = [
  "yugioh","yu-gi-oh","magic the gathering","mtg","digimon","one piece",
  "dragon ball","lorcana","flesh and blood","cardfight","vanguard","weiss",
  "buddyfight","gundam","star wars","marvel","naruto","single","graded",
  "psa","bgs","cgc","lot of","proxy","fake","sleeve","sleeves","deck box",
  "playmat","binder","dice","coin","energy cards","card lot","bulk",
  "funko","plush","figure",
];

function isValid(title) {
  const t = title.toLowerCase();
  if (!t.includes("pokemon")) return false;
  if (EXCLUDE.some(k => t.includes(k))) return false;
  if (!PRODUCT_KEYWORDS.some(k => t.includes(k))) return false;
  return true;
}

function getRRP(title) {
  const t = title.toLowerCase();
  for (const [k,v] of Object.entries(RRP)) if (t.includes(k)) return v;
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
  if (d<=-15) return "excellent";
  if (d<=-5)  return "good";
  if (d<=5)   return "fair";
  if (d<=20)  return "slightly";
  return "overpriced";
}

const LABELS = {
  excellent:"🔥 EXCELLENT DEAL", good:"✅ GOOD DEAL",
  fair:"⚖️ FAIR PRICE", slightly:"⚠️ SLIGHTLY OVERPRICED", overpriced:"❌ OVERPRICED",
};

const TERMS = [
  "pokemon tcg ascended heroes","pokemon tcg destined rivals",
  "pokemon tcg perfect order","pokemon tcg chaos rising",
  "pokemon tcg phantasmal flames","pokemon tcg journey together",
  "pokemon tcg prismatic evolutions","pokemon tcg surging sparks",
  "pokemon tcg stellar crown","pokemon tcg shrouded fable",
  "pokemon tcg twilight masquerade","pokemon tcg temporal forces",
  "pokemon tcg paradox rift","pokemon tcg obsidian flames",
  "pokemon tcg paldea evolved","pokemon tcg 151",
  "pokemon tcg paldean fates","pokemon tcg evolving skies",
  "pokemon tcg brilliant stars","pokemon tcg fusion strike",
  "pokemon tcg lost origin","pokemon tcg silver tempest",
  "pokemon tcg crown zenith","pokemon tcg chilling reign",
  "pokemon tcg battle styles","pokemon tcg shining fates",
  "pokemon tcg hidden fates","pokemon tcg vivid voltage",
  "pokemon tcg darkness ablaze","pokemon tcg cosmic eclipse",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

// Generic Shopify parser — works for most UK TCG stores
function shopifyParse($, baseUrl) {
  const items = [];
  $(".product-card, .grid__item, .card-wrapper, .product-item").each((_, el) => {
    const title = $(el).find("h3, h4, .card__heading, .product-title, .product-item__title").first().text().trim();
    const priceText = $(el).find(".price, .price__regular, .product-price").first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    const link = $(el).find("a").first().attr("href");
    const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
    if (title && !soldOut && price && link) {
      items.push({ title, price, url: link.startsWith("http") ? link : `${baseUrl}${link}` });
    }
  });
  return items;
}

const RETAILERS = [
  { name: "Total Cards", base: "https://totalcards.net", url: q => `https://totalcards.net/search?q=${encodeURIComponent(q)}`, parse: shopifyParse },
  { name: "Titan Cards", base: "https://titancards.co.uk", url: q => `https://titancards.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Magic Madhouse", base: "https://magicmadhouse.co.uk", url: q => `https://magicmadhouse.co.uk/search?q=${encodeURIComponent(q)}`, parse: ($, base) => {
    const items = [];
    $(".product-card, .product-listing").each((_, el) => {
      const title = $(el).find("h3, h4, .product-name").first().text().trim();
      const priceText = $(el).find(".price, .product-price").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");
      if (title && !soldOut && price && link) items.push({ title, price, url: link.startsWith("http") ? link : `${base}${link}` });
    });
    return items;
  }},
  { name: "Chaos Cards", base: "https://www.chaoscards.co.uk", url: q => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`, parse: ($, base) => {
    const items = [];
    $(".product-item, .product-card").each((_, el) => {
      const title = $(el).find("h3, h4, .product-title").first().text().trim();
      const priceText = $(el).find(".price, .product-price").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");
      if (title && !soldOut && price && link) items.push({ title, price, url: link.startsWith("http") ? link : `${base}${link}` });
    });
    return items;
  }},
  { name: "Eterna Cards", base: "https://eternacards.co.uk", url: q => `https://eternacards.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "PACKRAT", base: "https://packratt.co.uk", url: q => `https://packratt.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Japan2UK", base: "https://www.japan2uk.com", url: q => `https://www.japan2uk.com/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Big Orbit", base: "https://www.bigorbitcards.co.uk", url: q => `https://www.bigorbitcards.co.uk/search?type=product&q=${encodeURIComponent(q)}`, parse: shopifyParse },
  { name: "Double Sleeved", base: "https://doublesleeved.co.uk", url: q => `https://doublesleeved.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Toys N Geek", base: "https://www.toysngeek.co.uk", url: q => `https://www.toysngeek.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "The Card Vault", base: "https://thecardvault.co.uk", url: q => `https://thecardvault.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "My TCG", base: "https://mytcg.co.uk", url: q => `https://mytcg.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Gathering Games", base: "https://gatheringgames.co.uk", url: q => `https://gatheringgames.co.uk/search?q=${encodeURIComponent(q)}&type=product`, parse: shopifyParse },
  { name: "Smyths", base: "https://www.smythstoys.com", url: q => `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}`, parse: ($, base) => {
    const items = [];
    $(".product-grid-item, .product-card").each((_, el) => {
      const title = $(el).find("h3, h4, .product-name").first().text().trim();
      const priceText = $(el).find(".price, .js-priceValue").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("out of stock");
      if (title && !soldOut && price) items.push({ title, price, url: link || base });
    });
    return items;
  }},
  { name: "Argos", base: "https://www.argos.co.uk", url: q => `https://www.argos.co.uk/search/${encodeURIComponent(q)}/`, parse: ($, base) => {
    const items = [];
    $("[data-test='component-product-card']").each((_, el) => {
      const title = $(el).find("[data-test='product-title'], h3").first().text().trim();
      const priceText = $(el).find("[data-test='price']").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("out of stock");
      if (title && !soldOut && price && link) items.push({ title, price, url: `${base}${link}` });
    });
    return items;
  }},
  { name: "GAME", base: "https://www.game.co.uk", url: q => `https://www.game.co.uk/search?q=${encodeURIComponent(q)}`, parse: ($, base) => {
    const items = [];
    $(".product, .product-card").each((_, el) => {
      const title = $(el).find("h3, h4, .product-title").first().text().trim();
      const priceText = $(el).find(".price").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("out of stock");
      if (title && !soldOut && price && link) items.push({ title, price, url: `${base}${link}` });
    });
    return items;
  }},
  { name: "Amazon UK", base: "https://www.amazon.co.uk", url: q => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}&rh=p_85%3A1`, parse: ($, base) => {
    const items = [];
    $("[data-component-type='s-search-result']").each((_, el) => {
      const title = $(el).find("h2 a span").first().text().trim();
      const priceText = $(el).find(".a-price-whole").first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      const link = $(el).find("h2 a").first().attr("href");
      const soldOut = $(el).text().toLowerCase().includes("currently unavailable");
      if (title && !soldOut && price && link) items.push({ title, price, url: `${base}${link}` });
    });
    return items;
  }},
];

const notified = new Set();

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await axios.get(url, { headers: HEADERS, signal: controller.signal, timeout });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function scrapeOne(retailer, term) {
  try {
    const res = await fetchWithTimeout(retailer.url(term), 8000);
    const $ = cheerio.load(res.data);
    return retailer.parse($, retailer.base).filter(r => isValid(r.title));
  } catch (e) {
    console.log(`  ⏭ [${retailer.name}] skipped: ${e.message.slice(0,40)}`);
    return [];
  }
}

async function sendTelegram(msg) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: false,
    });
    console.log("  📱 Alert sent!");
  } catch (e) {
    console.log("  ❌ Telegram error:", e.message);
  }
}

async function runScan() {
  console.log(`\n🔍 ${RETAILERS.length} retailers · ${TERMS.length} sets · ${new Date().toLocaleTimeString("en-GB")}`);
  const findings = [];

  // Run each search term with ALL retailers in parallel — much faster
  for (const term of TERMS) {
    const results = await Promise.all(
      RETAILERS.map(r => scrapeOne(r, term).then(items => items.map(i => ({ ...i, retailer: r.name }))))
    );

    for (const retailerItems of results) {
      for (const r of retailerItems) {
        const rrp = getRRP(r.title);
        const resell = getResell(r.title);
        if (!rrp || !resell) continue;

        const key = `${r.retailer}::${r.url||r.title}`;
        if (!notified.has(key)) {
          notified.add(key);
          findings.push({ ...r, rrp, resell });
          console.log(`  🟢 [${r.retailer}] ${r.title} — £${r.price}`);
        }
      }
    }

    // Small pause between search terms to be polite
    await new Promise(r => setTimeout(r, 200));
  }

  // Send Telegram alerts
  for (const f of findings) {
    const score = dealScore(f.price, f.rrp);
    const vsRrp = Math.round(((f.price-f.rrp)/f.rrp)*100);
    const vsResell = Math.round(((f.resell-f.price)/f.price)*100);
    const flipProfit = (f.resell - f.price - (f.resell*0.13) - 4).toFixed(2);

    const msg = [
      LABELS[score], ``,
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

  console.log(findings.length > 0
    ? `\n✅ ${findings.length} alerts sent.`
    : "\n⬜ No new confirmed findings."
  );
}

console.log("🚀 Lock3y's PokéScraper");
console.log(`📦 Boxes · ETBs · Bundles · Packs · Tins`);
console.log(`⚡ Parallel scraping — fast & timeout-safe\n`);

runScan().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
