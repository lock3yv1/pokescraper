const axios = require("axios");
const cheerio = require("cheerio");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

// ─── CONFIG ────────────────────────────────────────────────────────────────
const EMAIL_TO = process.env.EMAIL_TO;       // your email
const EMAIL_FROM = process.env.EMAIL_FROM;   // gmail address
const EMAIL_PASS = process.env.EMAIL_PASS;   // gmail app password
const CHECK_INTERVAL = "*/10 * * * *";       // every 10 minutes

const PRODUCTS = [
  // Ascended Heroes
  "ascended heroes booster box",
  "ascended heroes elite trainer box",
  "ascended heroes etb",
  "ascended heroes booster bundle",
  "ascended heroes half box",
  "ascended heroes booster pack",
  "ascended heroes mini tins",
  "ascended heroes collection box",
  "ascended heroes poster collection",
  // Destined Rivals
  "destined rivals booster box",
  "destined rivals elite trainer box",
  "destined rivals etb",
  "destined rivals booster bundle",
  "destined rivals half box",
  "destined rivals booster pack",
  "destined rivals collection box",
  "destined rivals poster collection",
  "destined rivals build battle box",
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
                        $(el).text().toLowerCase().includes("out of stock") ||
                        $(el).find(".sold-out, .badge--sold-out").length > 0;
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
        const soldOut = $(el).text().toLowerCase().includes("sold out") ||
                        $(el).find("[class*='sold']").length > 0;
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
    name: "Big Orbit Cards",
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
    name: "APLA Cards",
    searchUrl: (q) => `https://www.aplacards.co.uk/search?q=${encodeURIComponent(q)}`,
    parseResults: ($) => {
      const items = [];
      $(".product-card, .grid__item, .product-item").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.aplacards.co.uk${link}` : null });
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
      $(".product-grid-item, .product-card, .product-listing").each((_, el) => {
        const title = $(el).find("h3, h4, .product-name, .product-title").first().text().trim();
        const priceText = $(el).find(".price, .product-price, .js-priceValue").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") ||
                        $(el).text().toLowerCase().includes("sold out");
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
      $("[data-test='component-product-card'], .ProductCardstyles__Wrapper").each((_, el) => {
        const title = $(el).find("[data-test='product-title'], h3, h4").first().text().trim();
        const priceText = $(el).find("[data-test='price'], .price").first().text().trim();
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
      $(".product, .product-card, .product-listing").each((_, el) => {
        const title = $(el).find("h3, h4, .product-title, .product-name").first().text().trim();
        const priceText = $(el).find(".price, .product-price").first().text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").first().attr("href");
        const soldOut = $(el).text().toLowerCase().includes("out of stock") ||
                        $(el).text().toLowerCase().includes("sold out");
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.game.co.uk${link}` : null });
        }
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
        if (title && !soldOut && price) {
          items.push({ title, price, url: link ? `https://www.johnlewis.com${link}` : null });
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
        const title = $(el).find("h2 a span, .a-text-normal").first().text().trim();
        const priceText = $(el).find(".a-price-whole, .a-price").first().text().trim();
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
  "Accept-Encoding": "gzip, deflate, br",
};

// ─── ALREADY NOTIFIED (prevents spam) ─────────────────────────────────────
const notifiedUrls = new Set();

// ─── SCRAPE ONE RETAILER ───────────────────────────────────────────────────
async function scrapeRetailer(retailer, product) {
  try {
    const url = retailer.searchUrl(product);
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const results = retailer.parseResults($);
    return results.filter(r =>
      r.title.toLowerCase().includes("ascended heroes") ||
      r.title.toLowerCase().includes("destined rivals")
    );
  } catch (e) {
    console.log(`[${retailer.name}] Error for "${product}": ${e.message}`);
    return [];
  }
}

// ─── SEND EMAIL ─────────────────────────────────────────────────────────────
async function sendAlert(findings) {
  if (!EMAIL_TO || !EMAIL_FROM || !EMAIL_PASS) {
    console.log("⚠️  Email not configured. Set EMAIL_TO, EMAIL_FROM, EMAIL_PASS env vars.");
    console.log("📦 IN STOCK FINDINGS:");
    findings.forEach(f => console.log(`  [${f.retailer}] ${f.title} — £${f.price} — ${f.url}`));
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
  });

  const rows = findings.map(f => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;font-weight:600;">${f.retailer}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${f.title}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:#e74c3c;font-weight:700;">£${f.price?.toFixed(2)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">
        <a href="${f.url}" style="background:#000;color:#fff;padding:6px 14px;text-decoration:none;border-radius:4px;font-size:12px;">BUY NOW →</a>
      </td>
    </tr>
  `).join("");

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject: `🔥 ${findings.length} Pokémon item${findings.length > 1 ? "s" : ""} IN STOCK — ${findings.map(f => f.retailer).join(", ")}`,
    html: `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
        <h1 style="background:#000;color:#fff;padding:20px;margin:0;font-size:22px;letter-spacing:2px;">POKÉMON STOCK ALERT 🔥</h1>
        <p style="padding:16px;background:#f9f9f9;margin:0;color:#666;font-size:13px;">
          Found ${findings.length} in-stock item${findings.length > 1 ? "s" : ""} at ${new Date().toLocaleString("en-GB")}
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:10px;text-align:left;font-size:12px;">RETAILER</th>
              <th style="padding:10px;text-align:left;font-size:12px;">PRODUCT</th>
              <th style="padding:10px;text-align:left;font-size:12px;">PRICE</th>
              <th style="padding:10px;text-align:left;font-size:12px;">LINK</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="padding:16px;font-size:11px;color:#aaa;">PokéScraper · checking every 10 minutes</p>
      </div>
    `,
  });

  console.log(`✅ Alert email sent for ${findings.length} items`);
}

// ─── MAIN SCAN ──────────────────────────────────────────────────────────────
async function runScan() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Starting scan across ${RETAILERS.length} retailers...`);
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
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (allFindings.length > 0) {
    await sendAlert(allFindings);
  } else {
    console.log("  ⬜ Nothing new in stock this scan.");
  }
}

// ─── START ──────────────────────────────────────────────────────────────────
console.log("🚀 PokéScraper started");
console.log(`📋 Watching: Ascended Heroes + Destined Rivals (all products)`);
console.log(`🏪 Checking ${RETAILERS.length} retailers`);
console.log(`⏱  Scanning every 10 minutes\n`);

// Run immediately on start
runScan();

// Then run on schedule
cron.schedule(CHECK_INTERVAL, runScan);
