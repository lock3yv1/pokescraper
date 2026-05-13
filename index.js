const axios = require("axios");
const cheerio = require("cheerio");

// ─────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const SCAN_INTERVAL = 1000 * 60 * 5; // 5 mins

const notified = new Set();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────

const PRODUCTS = [
  {
    name: "Prismatic Evolutions ETB",
    keywords: ["prismatic evolutions", "elite trainer box"],
    rrp: 49.99,
    resell: 95,
  },
  {
    name: "151 Booster Bundle",
    keywords: ["151", "booster bundle"],
    rrp: 24.99,
    resell: 55,
  },
  {
    name: "Surging Sparks Booster Box",
    keywords: ["surging sparks", "booster box"],
    rrp: 143.64,
    resell: 155,
  },
  {
    name: "Evolving Skies Booster Box",
    keywords: ["evolving skies", "booster box"],
    rrp: 143.64,
    resell: 800,
  },
];

// ─────────────────────────────────────────────
// RETAILERS
// ─────────────────────────────────────────────

const RETAILERS = [
  {
    name: "Total Cards",
    url: (search) =>
      `https://totalcards.net/search?q=${encodeURIComponent(search)}`,

    parse: ($) => {
      const items = [];

      $(".product-item").each((_, el) => {
        const title = $(el)
          .find(".product-item__title")
          .text()
          .trim();

        const priceText = $(el)
          .find(".price")
          .first()
          .text()
          .trim();

        const link = $(el).find("a").attr("href");

        const price = parseFloat(
          priceText.replace(/[^0-9.]/g, "")
        );

        if (title && price) {
          items.push({
            title,
            price,
            url: `https://totalcards.net${link}`,
          });
        }
      });

      return items;
    },
  },

  {
    name: "Chaos Cards",

    url: (search) =>
      `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(search)}`,

    parse: ($) => {
      const items = [];

      $(".product-item").each((_, el) => {
        const title = $(el)
          .find("h3")
          .text()
          .trim();

        const priceText = $(el)
          .find(".price")
          .text()
          .trim();

        const link = $(el).find("a").attr("href");

        const price = parseFloat(
          priceText.replace(/[^0-9.]/g, "")
        );

        if (title && price) {
          items.push({
            title,
            price,
            url: `https://www.chaoscards.co.uk${link}`,
          });
        }
      });

      return items;
    },
  },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function matchesProduct(title, product) {
  const lower = title.toLowerCase();

  return product.keywords.every((k) =>
    lower.includes(k.toLowerCase())
  );
}

function calculateProfit(buy, resell) {
  const ebayFees = resell * 0.13;
  return (resell - buy - ebayFees - 4).toFixed(2);
}

function getDealRating(price, rrp) {
  const diff = ((price - rrp) / rrp) * 100;

  if (diff <= -15) return "🔥 EXCELLENT";
  if (diff <= -5) return "✅ GOOD";
  if (diff <= 5) return "⚖️ FAIR";

  return "❌ OVERPRICED";
}

// ─────────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────────

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram not configured");
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }
    );
  } catch (err) {
    console.log("Telegram Error:", err.message);
  }
}

// ─────────────────────────────────────────────
// SCRAPER
// ─────────────────────────────────────────────

async function scrapeRetailer(retailer, product) {
  try {
    const searchQuery = product.name;

    console.log(
      `🔎 ${retailer.name} → ${searchQuery}`
    );

    const response = await axios.get(
      retailer.url(searchQuery),
      {
        headers: HEADERS,
        timeout: 15000,
      }
    );

    const $ = cheerio.load(response.data);

    const results = retailer.parse($);

    return results.filter((r) =>
      matchesProduct(r.title, product)
    );
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
  console.log("\n🚀 Starting Scan...\n");

  for (const retailer of RETAILERS) {
    for (const product of PRODUCTS) {
      const items = await scrapeRetailer(
        retailer,
        product
      );

      for (const item of items) {
        const uniqueKey = `${retailer.name}-${item.url}`;

        if (notified.has(uniqueKey)) {
          continue;
        }

        notified.add(uniqueKey);

        const profit = calculateProfit(
          item.price,
          product.resell
        );

        const rating = getDealRating(
          item.price,
          product.rrp
        );

        const message = `
${rating}

<b>${item.title}</b>

🏪 ${retailer.name}

💰 Price: £${item.price}
📈 Resell: £${product.resell}
💵 Profit: £${profit}

<a href="${item.url}">Buy Now</a>
`;

        console.log(message);

        await sendTelegram(message);

        await new Promise((r) =>
          setTimeout(r, 1500)
        );
      }

      await new Promise((r) =>
        setTimeout(r, 1000)
      );
    }
  }

  console.log("\n✅ Scan Complete\n");
}

// ─────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────

async function start() {
  console.log("🚀 Lock3y's PokéScraper Running");

  while (true) {
    try {
      await runScan();
    } catch (err) {
      console.log("Fatal Scan Error:", err.message);
    }

    console.log(
      `⏳ Waiting ${SCAN_INTERVAL / 60000} mins...\n`
    );

    await new Promise((r) =>
      setTimeout(r, SCAN_INTERVAL)
    );
  }
}

start();