import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "chaos rising": { pack: 5.75, blister: 13.99, tin: 21.99, bundle: 35.00, etb: 55.00, box: 155.00 },
  "151": { pack: 8.50, bundle: 85.00, etb: 115.00, upc: 185.00, collection: 45.00 },
  "prismatic evolutions": { pack: 6.50, bundle: 68.00, etb: 110.00 },
  "surging sparks": { pack: 4.50, bundle: 32.00, etb: 55.00, box: 155.00 }
};

// FULL UK RETAILER NETWORK (35+ STORES)
const RETAILERS = [
  "https://www.pokemoncenter.com/en-gb", "https://totalcards.net", "https://www.chaoscards.co.uk",
  "https://www.magicmadhouse.co.uk", "https://thecardvault.co.uk", "https://www.gatheringgames.co.uk",
  "https://titancards.co.uk", "https://japan2uk.com", "https://www.zatu.co.uk", "https://www.totalcards.net",
  "https://www.theothergames.co.uk", "https://www.smythstoys.com/uk/en-gb", "https://www.argos.co.uk",
  "https://www.thebrotherhoodgames.co.uk", "https://www.cosmiccollectables.co.uk", "https://www.geek-retreat.uk",
  "https://www.double-sleeved.com", "https://pixel-hub.co.uk", "https://www.koolthings.co.uk",
  "https://www.pokehub.com", "https://venovacollects.com", "https://akeycollects.com", "https://dropiitradingcard.com",
  "https://www.hobbystore.co.uk", "https://www.cardmarket.com/en/Pokemon", "https://www.hills-cards.com",
  "https://www.firestormcards.co.uk", "https://www.WaylandGames.co.uk", "https://www.GoblinGaming.co.uk",
  "https://www.EclecticGames.co.uk", "https://www.BoardGameGuru.co.uk", "https://www.DarkSphere.co.uk",
  "https://www.PatriotGames.uk", "https://www.LeisureGames.com", "https://www.GamesLore.com"
];

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("pack") || t.includes("sleeved")) type = "pack";
  else if (t.includes("blister")) type = "blister";
  else if (t.includes("tin")) type = "tin";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("box") || t.includes("display")) type = "box";

  if (!type) return null;
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  if (!setKey) return null;

  const market = MARKET_DATA[setKey][type];
  const flip = ((market * 0.86) - price - 4).toFixed(2);
  
  // High-demand sets are instant pings in 2026
  const isPriority = t.includes("151") || t.includes("chaos rising") || t.includes("prismatic");
  const isDeal = isPriority || (parseFloat(flip) > 3.00);

  return { type, market, flip, isDeal };
}

async function run() {
  console.log(`📡 FULL UK MARKET SCAN: Tracking ${RETAILERS.length} Retailers...`);
  const notified = new Set();

  for (const base of RETAILERS) {
    try {
      const q = ["151", "chaos+rising", "prismatic+evolutions", "booster+box"][Math.floor(Math.random() * 4)];
      
      // Adapt search URL for different platforms
      let searchUrl = `${base}/search?q=${q}`;
      if (base.includes("pokemoncenter")) searchUrl = `${base}/search/${q}`;
      if (base.includes("argos")) searchUrl = `${base}/browse/toys/family-games/trading-cards-and-card-games/c:30425/brands:pokemon/`;

      const res = await fetch(searchUrl, { 
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } 
      });
      if (!res.ok) continue;

      const $ = cheerio.load(await res.text());
      const items = $(".product-card, .product-item, .product, .grid-item, .m-product-card, .ac-product-card, .product-item-info").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name, .product-title, .product-item-name").first().text().trim();
        const priceText = $(el).find(".price, .money, .amount, .price_root, .price-container").first().text().replace(/[^0-9.]/g, "");
        const price = parseFloat(priceText);
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");

        if (title && price > 1 && link && !oos) {
          const analysis = getAnalysis(title, price);
          if (analysis && analysis.isDeal && !notified.has(link)) {
            notified.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            
            const msg = `👑 **ULTRA MARKET ALERT**\n📦 ${analysis.type.toUpperCase()}\n\n<b>${title}</b>\n🏪 ${new URL(base).hostname.replace('www.', '')}\n\n💰 **BUY:** £${price.toFixed(2)}\n📈 **EST. MARKET:** £${analysis.market.toFixed(2)}\n💸 **EST. FLIP:** £${analysis.flip}\n\n👉 <a href="${fullLink}">SECURE STOCK →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(1000);
          }
        }
      }
    } catch (e) { console.log(`[!] ${base.split('.')[1]} - Bypassing (Server Busy)`); }
    await wait(2000); // Respectful crawl delay
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
