import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "151": { box: 190, bundle: 70, etb: 85, upc: 155, collection: 35, strategy: "Long Term 💎" },
  "evolving skies": { box: 880, etb: 210, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 235, etb: 110, bundle: 55, strategy: "High Demand 🔥" },
  "surging sparks": { box: 165, etb: 65, bundle: 65, strategy: "Medium Term 📈" },
  "ascended heroes": { box: 190, etb: 90, bundle: 60, strategy: "Medium Term 📈" },
  "destined rivals": { box: 165, etb: 85, bundle: 75, strategy: "Medium Term 📈" },
  "chaos rising": { box: 155, etb: 55, bundle: 32, strategy: "New Release 🚀" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, collection: 29.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  else if (t.includes("collection") || t.includes("poster")) type = "collection";
  
  if (!type) return null;

  let setKey = null;
  for (const set in MARKET_DATA) { if (t.includes(set)) { setKey = set; break; } }
  if (!setKey || !MARKET_DATA[setKey][type]) return null;

  let quantity = 1;
  const isCase = t.includes("case") || t.includes("sealed case");
  if (isCase) {
    const qtyMatch = t.match(/\((\d+)\)/) || t.match(/(\d+)\s*x/) || t.match(/case of (\d+)/);
    quantity = qtyMatch ? parseInt(qtyMatch[1]) : (type === "box" ? 6 : type === "etb" ? 10 : type === "bundle" ? 25 : 1);
  }

  const unitMarket = MARKET_DATA[setKey][type];
  const totalMarket = unitMarket * quantity;
  const totalRRP = (RRP_MAP[type] || unitMarket) * quantity;
  const shipping = isCase ? 15 : 4;
  const netReturn = (totalMarket * 0.87); // 13% eBay Fees
  const flip = (netReturn - price - shipping).toFixed(2);
  const margin = (((netReturn - shipping) / price) - 1) * 100;

  return { 
    isCase, quantity, resell: totalMarket, rrp: totalRRP, 
    flip, margin: margin.toFixed(1), strategy: MARKET_DATA[setKey].strategy, 
    isDeal: parseFloat(flip) > 2.00 
  };
}

async function run() {
  console.log("🚀 SNIPER ACTIVE...");
  
  // Heartbeat message
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: "🤖 **Scraper Pro Online.** Monitoring market for deals...", parse_mode: "HTML" })
  });

  const RETAILERS = [
    "https://japan2uk.com", "https://thecardvault.co.uk", "https://doublesleeved.co.uk",
    "https://mytcg.co.uk", "https://hillscards.co.uk", "https://cosmiccollectables.co.uk",
    "https://totalcards.net", "https://minisouk.com", "https://brotherhoodgames.co.uk"
  ];

  for (const base of RETAILERS) {
    try {
      const res = await fetch(`${base}/search?q=pokemon&sort_by=created-descending`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $(".product-card, .product-item, .grid__item, .product").each(async (_, el) => {
        const title = $(el).find("h2, h3, .title, .product-title").first().text().trim();
        const price = parseFloat($(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");
        const outOfStock = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");

        if (title && price > 5 && link && !outOfStock) {
          const analysis = getAnalysis(title, price);
          if (analysis) {
            const status = analysis.isDeal ? "✅ **PROFITABLE DEAL**" : "❌ NO MARGIN";
            const label = analysis.isCase ? `📦 CASE OF ${analysis.quantity}` : `🃏 SINGLE ITEM`;
            const shop = base.replace('https://', '').replace('www.', '');
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;

            const msg = `${status}\n(${label})\n\n<b>${title}</b>\n🏪 ${shop}\n\n💰 **BUY:** £${price.toFixed(2)}\n🏷️ **RRP:** £${analysis.rrp.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n\n💸 **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
          }
        }
      });
    } catch (e) { console.error(`Error scanning ${base}`); }
    await wait(1500);
  }
}

run().catch(console.error);
