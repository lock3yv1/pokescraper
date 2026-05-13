const axios = require("axios");
const cheerio = require("cheerio");

// ─────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────

const SCAN_INTERVAL = 1000 * 60 * 5;

const notified = new Set();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// ─────────────────────────────────────────────
// SEARCH TERMS
// ─────────────────────────────────────────────

const SEARCH_TERMS = [
  // Mega Evolution
  "pokemon ascended heroes",
  "pokemon destined rivals",
  "pokemon perfect order",
  "pokemon chaos rising",
  "pokemon phantasmal flames",

  // Scarlet & Violet
  "pokemon prismatic evolutions",
  "pokemon journey together",
  "pokemon surging sparks",
  "pokemon stellar crown",
  "pokemon shrouded fable",
  "pokemon twilight masquerade",
  "pokemon temporal forces",
  "pokemon paradox rift",
  "pokemon obsidian flames",
  "pokemon paldea evolved",
  "pokemon paldean fates",
  "pokemon 151",

  // Sword & Shield
  "pokemon evolving skies",
  "pokemon brilliant stars",
  "pokemon fusion strike",
  "pokemon lost origin",
  "pokemon silver tempest",
  "pokemon crown zenith",
  "pokemon astral radiance",
  "pokemon chilling reign",
  "pokemon battle styles",
  "pokemon hidden fates",
  "pokemon cosmic eclipse",
];

// ─────────────────────────────────────────────
// PRODUCT KEYWORDS
// ─────────────────────────────────────────────

const SEALED_KEYWORDS = [
  "booster box",
  "elite trainer box",
  "etb",
  "booster bundle",
  "bundle",
  "premium collection",
  "ultra premium collection",
  "upc",
  "collection box",
  "poster collection",
  "tin",
  "mini tin",
  "build and battle",
  "build & battle",
  "league battle deck",
];

const EXCLUDED_KEYWORDS = [
  // non pokemon
  "yugioh",
  "lorcana",
  "one piece",
  "digimon",
  "magic the gathering",
  "mtg",

  // singles/accessories
  "single",
  "proxy",
  "psa",
  "bgs",
  "cgc",
  "slab",
  "graded",
  "playmat",
  "binder",
  "deck box",
  "sleeves",
  "dice",

  // foreign
  "japanese",
  "jp",
  "korean",
  "chinese",
];

// ─────────────────────────────────────────────
// RETAILERS
// ─────────────────────────────────────────────

const RETAILERS = [
  {
    name: "Total Cards",
    url: q =>
      `https://totalcards.net/search?q=${encodeURIComponent(q)}`,

    selector: ".product-item",
  },

  {
    name: "Chaos Cards",
    url: q =>
      `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}`,

    selector: ".product-item",
  },

  {
    name: "Magic Madhouse",
    url: q =>
      `https://magicmadhouse.co.uk/search?q=${encodeURIComponent(q)}`,

    selector: ".product-card",
  },

  {
    name: "Titan Cards",
    url: q =>
      `https://titancards.co.uk/search?q=${encodeURIComponent(q)}`,

    selector: ".product-card",
  },

  {
    name: "Pokemon Center UK",
    url: q =>
      `https://www.pokemoncenter.com/en-gb/search?q=${encodeURIComponent(q)}`,

    selector: "[class*=product]",
  },

  {
    name: "Smyths",
    url: q =>
      `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}`,

    selector: ".product-grid-item",
  },

  {
    name: "Argos",
    url: q =>
      `https://www.argos.co.uk/search/${encodeURIComponent(q)}/`,

    selector: "[data-test='component-product-card']",
  },

  {
    name: "GAME",
    url: q =>
      `https://www.game.co.uk/search?q=${encodeURIComponent(q)}`,

    selector: ".product",
  },

  {
    name: "Very",
    url: q =>
      `https://www.very.co.uk/e/q/${encodeURIComponent(q)}.end`,

    selector: "[data-testid='product-card']",
  },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function isPokemonProduct(title) {
  const t = title.toLowerCase();

  if (!t.includes("pokemon")) {
    return false;
  }

  if (
    EXCLUDED_KEYWORDS.some(k => t.includes(k))
  ) {
    return false;
  }

  if (
    !SEALED_KEYWORDS.some(k => t.includes(k))
  ) {
    return false;
  }

  return true;
}

function getPrice(text) {
  if (!text) return null;

  const cleaned = text.replace(/[^0-9.]/g, "");

  return parseFloat(cleaned);
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }
    );
  } catch (err) {
    console.log("Telegram Error:", err.message);
  }
}

// ─────────────────────────────────────────────
// SCRAPER
// ─────────────────────────────────────────────

async function scrapeRetailer(retailer, term) {
  try {
    console.log(`🔎 ${retailer.name} → ${term}`);

    const response = await axios.get(
      retailer.url(term),
      {
        headers: HEADERS,
        timeout: 15000,
      }
    );

    const $ = cheerio.load(response.data);

    const items = [];

    $(retailer.selector).each((_, el) => {
      const title = $(el)
        .find("h1,h2,h3,h4,a,.title,.product-title")
        .first()
        .text()
        .trim();

      const priceText = $(el)
        .find(
          ".price,.product-price,[class*=price]"
        )
        .first()
        .text()
        .trim();

      const price = getPrice(priceText);

      const link = $(el)
        .find("a")
        .first()
        .attr("href");

      if (!title || !price) {
        return;
      }

      if (!isPokemonProduct(title)) {
        return;
      }

      const url = link?.startsWith("http")
        ? link
        : `${new URL(retailer.url("")).origin}${link}`;

      items.push({
        title,
        price,
        url,
      });
    });

    return items;
  } catch (err) {
    console.log(
      `❌ ${retailer.name}: ${err.message}`
    );

    return [];
  }
}

// ─────────────────────────────────────────────
// MAIN SCAN
// ─────────────────────────────────────────────

async function runScan() {
  console.log("\n🚀 STARTING SCAN\n");

  for (const retailer of RETAILERS) {
    for (const term of SEARCH_TERMS) {
      const items = await scrapeRetailer(
        retailer,
        term
      );

      for (const item of items) {
        const uniqueKey =
          retailer.name + item.url;

        if (notified.has(uniqueKey)) {
          continue;
        }

        notified.add(uniqueKey);

        const message = `
🚨 <b>POKEMON STOCK FOUND</b>

🏪 ${retailer.name}

📦 ${item.title}

💰 £${item.price}

<a href="${item.url}">BUY NOW</a>
`;

        console.log(
          `[FOUND] ${item.title} (£${item.price})`
        );

        await sendTelegram(message);

        await new Promise(r =>
          setTimeout(r, 1200)
        );
      }

      await new Promise(r =>
        setTimeout(r, 800)
      );
    }
  }

  console.log("\n✅ SCAN COMPLETE\n");
}

// ─────────────────────────────────────────────
// START LOOP
// ─────────────────────────────────────────────

async function start() {
  console.log("🚀 Lock3y's UK Pokémon Scanner");

  while (true) {
    try {
      await runScan();
    } catch (err) {
      console.log("Fatal Error:", err.message);
    }

    console.log(
      `⏳ Waiting ${SCAN_INTERVAL / 60000} mins...\n`
    );

    await new Promise(r =>
      setTimeout(r, SCAN_INTERVAL)
    );
  }
}

start();