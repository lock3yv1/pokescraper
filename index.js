import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2026 Market Valuations for various product types
const VALUATION_LOGIC = {
  pack: { rrp: 4.29, market: 5.75 },
  bundle: { rrp: 24.99, market: 35.00 },
  etb: { rrp: 49.99, market: 58.00 },
  box: { rrp: 144.99, market: 158.00 }
};

const RETAILERS = [
  { name: "Pokemon Center", url: "https://www.pokemoncenter.com/en-gb/category/trading-card-game" },
  { name: "Total Cards", url: "https://totalcards.net/collections/pokemon" },
  { name: "Chaos Cards", url: "https://www.chaoscards.co.uk/shop/card-games/pokemon" },
  { name: "Magic Madhouse", url: "https://www.magicmadhouse.co.uk/pokemon-c1" },
  { name: "Smyths", url: "https://www.smythstoys.com/uk/en-gb/search/?text=pokemon" },
  { name: "Argos", url: "https://www.argos.co.uk/browse/toys/pokemon/c:30425/" },
  { name: "The Card Vault", url: "https://thecardvault.co.uk/collections/pokemon-tcg" },
  { name: "Japan2UK", url: "https://japan2uk.com/collections/pokemon-tcg" }
];

function getProductType(title) {
  const t = title.toLowerCase();
  if (t.includes("booster box") || t.includes("display box")) return "box";
  if (t.includes("etb") || t.includes("elite trainer box")) return "etb";
  if (t.includes("booster bundle")) return "bundle";
  if (t.includes("booster pack") || t.includes("sleeved booster")) return "pack";
  return "other";
}

async function run() {
  console.log(`🚀 STARTING UNFILTERED SCAN: Monitoring all items at ${RETAILERS.length} retailers...`);
  const seen = new Set();

  for (const shop of RETAILERS) {
    try {
      const res = await fetch(shop.url, { 
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0" } 
      });
      if (!res.ok) continue;

      const $ = cheerio.load(await res.text());
      // Broad selectors to catch any product card in 2026
      const items = $(".product-card, .product-item, .product, .grid-item, .m-product-card, .ac-product-card, .product-item-info").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name, .product-title, .product-item-name").first().text().trim();
        const priceRaw = $(el).find(".price, .money, .amount, .price_root, .price-container").first().text().replace(/[^0-9.]/g, "");
        const price = parseFloat(priceRaw);
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().match(/out of stock|sold out|unavailable/);

        if (title && price > 1 && link && !oos && !seen.has(link)) {
          seen.add(link);
          const type = getProductType(title);
          const market = VALUATION_LOGIC[type]?.market || price;
          const profit = ((market * 0.85) - price - 4).toFixed(2);

          // PING CONDITION: Is it a known set at RRP, or anything showing profit?
          const isHighDemand = title.match(/151|Chaos Rising|Prismatic|Mega Evolution/i);
          const isDeal = isHighDemand || parseFloat(profit) > 1.0;

          if (isDeal) {
            const fullLink = link.startsWith("http") ? link : `${new URL(shop.url).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            const msg = `💎 **NEW STOCK DETECTED**\n\n<b>${title}</b>\n🏪 ${shop.name}\n\n💰 **PRICE:** £${price.toFixed(2)}\n💸 **EST. PROFIT:** £${profit}\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(1000);
          }
        }
      }
    } catch (e) { console.log(`[!] Error scanning ${shop.name}`); }
    await wait(3000); // 2026 Rate-limit respect
  }
}

run().then(() => process.exit(0));
