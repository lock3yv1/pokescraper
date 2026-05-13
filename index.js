import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2026 Target Market Data
const MARKET_DATA = {
  "chaos rising": { pack: 4.29, blister: 13.99, tin: 21.99, bundle: 35.00, etb: 55.00, box: 155.00 },
  "151": { pack: 8.50, bundle: 85.00, etb: 115.00, upc: 185.00, collection: 45.00 },
  "prismatic evolutions": { pack: 6.50, bundle: 68.00, etb: 110.00 },
  "surging sparks": { pack: 4.50, bundle: 32.00, etb: 55.00, box: 155.00 }
};

const RRP_MAP = { pack: 4.29, blister: 13.99, tin: 21.99, bundle: 24.99, etb: 49.99, box: 144.99 };

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
  const rrp = RRP_MAP[type] || market;
  const flip = ((market * 0.86) - price - 4).toFixed(2);
  
  // Alert if at RRP or making £3 profit
  const isDeal = (price <= rrp * 1.08) || (parseFloat(flip) > 3.00);
  return { type, rrp, market, flip, isDeal };
}

async function run() {
  const RETAILERS = [
    "https://www.magicmadhouse.co.uk", "https://thecardvault.co.uk", "https://www.totalcards.net", 
    "https://japan2uk.com", "https://www.zatu.co.uk", "https://www.gatheringgames.co.uk", 
    "https://titancards.co.uk", "https://www.theothergames.co.uk"
  ];

  const notified = new Set();
  console.log(`🌐 Starting scan of ${RETAILERS.length} retailers...`);

  for (const base of RETAILERS) {
    try {
      const q = ["151", "chaos+rising", "pokemon+tins", "booster+box"][Math.floor(Math.random() * 4)];
      const res = await fetch(`${base}/search?q=${q}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;

      const $ = cheerio.load(await res.text());
      const items = $(".product-card, .product-item, .product, .grid-item, .m-product-card").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name").first().text().trim();
        const price = parseFloat($(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().includes("out of stock") || $(el).text().toLowerCase().includes("sold out");

        if (title && price > 1 && link && !oos) {
          const analysis = getAnalysis(title, price);
          if (analysis && analysis.isDeal && !notified.has(link)) {
            notified.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            
            const msg = `🎯 **DEAL FOUND**\n📦 ${analysis.type.toUpperCase()}\n\n<b>${title}</b>\n🏪 ${new URL(base).hostname}\n\n💰 **BUY:** £${price.toFixed(2)}\n🏷️ **RRP:** £${analysis.rrp.toFixed(2)}\n📈 **MARKET:** £${analysis.market.toFixed(2)}\n💸 **FLIP:** £${analysis.flip}\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(1000);
          }
        }
      }
    } catch (e) { console.error(`Error: ${base}`); }
    await wait(2000);
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
