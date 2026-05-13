import * as cheerio from 'cheerio';
// Added check for global fetch (standard in Node 18+, but safe for older environments)
const nodeFetch = globalThis.fetch; 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "chaos rising": { pack: 4.29, blister: 13.99, tin: 21.99, minitin: 10.99, bundle: 35.00, etb: 55.00, box: 155.00, strategy: "May 22 Launch 🚀" },
  "151": { pack: 8.50, bundle: 85.00, etb: 115.00, upc: 185.00, collection: 45.00, strategy: "Restock Priority 🚨" },
  "perfect order": { pack: 6.45, blister: 13.95, bundle: 28.00, etb: 50.00, box: 145.00, strategy: "Stable 📈" },
  "ascended heroes": { pack: 11.95, bundle: 65.00, etb: 95.00, box: 195.00, strategy: "Premium 💎" }
};

const RRP_MAP = { pack: 4.29, blister: 13.99, tin: 21.99, minitin: 10.99, bundle: 24.99, etb: 49.99, box: 144.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("booster pack") || t.includes("sleeved booster")) type = "pack";
  else if (t.includes("blister") || t.includes("checklane")) type = "blister";
  else if (t.includes("mini tin") || t.includes("lumiose")) type = "minitin";
  else if (t.includes("tin") && !t.includes("mini")) type = "tin";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("box") || t.includes("display")) type = "box";

  if (!type) return null;
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  if (!setKey || !MARKET_DATA[setKey][type]) return null;

  const unitMarket = MARKET_DATA[setKey][type];
  const rrp = RRP_MAP[type] || unitMarket;
  const shipping = (type === "pack" || type === "blister") ? 1.50 : 4.00;
  const netReturn = (unitMarket * 0.86) - shipping;
  const flip = (netReturn - price).toFixed(2);
  const isDeal = (price <= rrp * 1.05) || (parseFloat(flip) > 3.00);

  return { type, rrp, resell: unitMarket, flip, isDeal, strategy: MARKET_DATA[setKey].strategy };
}

async function run() {
  console.log("🛰️ WIDE-ANGLE SCANNER ACTIVE...");
  const RETAILERS = [
    "https://www.magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://thecardvault.co.uk",
    "https://www.theothergames.co.uk", "https://www.totalcards.net", "https://japan2uk.com",
    "https://www.zatu.co.uk", "https://www.gatheringgames.co.uk", "https://titancards.co.uk"
  ];

  const notified = new Set();

  for (const base of RETAILERS) {
    try {
      const q = ["chaos+rising", "151", "blister", "mini+tin"][Math.floor(Math.random() * 4)];
      const res = await nodeFetch(`${base}/search?q=${q}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      
      const html = await res.text();
      const $ = cheerio.load(html);
      const items = $(".product-card, .product-item, .product, .grid-item").toArray();

      for (const el of items) {
        const title = $(el).find("h2, h3, .title, .name").first().text().trim();
        const priceText = $(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, "");
        const price = parseFloat(priceText);
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");

        if (title && price > 1 && link && !oos) {
          const analysis = getAnalysis(title, price);
          if (analysis && analysis.isDeal && !notified.has(link)) {
            notified.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            const msg = `🎯 **NEW DROP FOUND**\n📦 Type: ${analysis.type.toUpperCase()}\n\n<b>${title}</b>\n🏪 ${base.split('.')[1]}\n\n💰 **BUY:** £${price.toFixed(2)}\n🏷️ **RRP:** £${analysis.rrp.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n\n💸 **EST. FLIP:** £${analysis.flip}\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

            await nodeFetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
            await wait(500); // Prevent Telegram rate limiting
          }
        }
      }
    } catch (e) { console.error(`Error scanning ${base}: ${e.message}`); }
    await wait(2000);
  }
}

run().catch(console.error);
