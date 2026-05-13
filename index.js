import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Expanded Market Data to catch more sets
const MARKET_DATA = {
  "151": { box: 195, bundle: 75, etb: 85, upc: 160, collection: 38, strategy: "Restock Priority 🚨" },
  "evolving skies": { box: 880, etb: 215, strategy: "Grail 💎" },
  "prismatic evolutions": { box: 240, etb: 115, bundle: 60, strategy: "High Demand 🔥" },
  "surging sparks": { box: 165, etb: 65, bundle: 65, strategy: "Mainline 📈" },
  "ascended heroes": { box: 195, etb: 95, bundle: 65, strategy: "Newer Set 📈" },
  "destined rivals": { box: 170, etb: 85, bundle: 75, strategy: "Medium Term 📈" },
  "chaos rising": { box: 155, etb: 55, bundle: 35, strategy: "Upcoming Drop 🚀" },
  "silver tempest": { box: 175, etb: 55, bundle: 42, strategy: "Long Term 💎" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, collection: 29.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  else if (t.includes("collection") || t.includes("poster") || t.includes("binder")) type = "collection";
  
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
  const netReturn = (totalMarket * 0.87); 
  const flip = (netReturn - price - shipping).toFixed(2);
  const margin = (((netReturn - shipping) / price) - 1) * 100;

  // LOWERED THRESHOLD: Show anything with > £1.00 profit
  return { 
    isCase, quantity, resell: totalMarket, rrp: totalRRP, 
    flip, margin: margin.toFixed(1), strategy: MARKET_DATA[setKey].strategy, 
    isDeal: parseFloat(flip) > 1.00 
  };
}

const RETAILERS = [
  "https://japan2uk.com", "https://thecardvault.co.uk", "https://doublesleeved.co.uk",
  "https://mytcg.co.uk", "https://hillscards.co.uk", "https://cosmiccollectables.co.uk",
  "https://totalcards.net", "https://minisouk.com", "https://brotherhoodgames.co.uk",
  "https://gatheringgames.co.uk", "https://pokemonplug.com", "https://thepokecave.co.uk"
];

const QUERIES = ["pokemon+151", "pokemon+booster+box", "pokemon+bundle", "sealed+case"];

async function run() {
  console.log("🚀 STARTING AGGRESSIVE SCAN...");
  const notified = new Set();

  for (const base of RETAILERS) {
    for (const query of QUERIES) {
      try {
        const res = await fetch(`${base}/search?q=${query}&sort_by=created-descending`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);

        $(".product-card, .product-item, .grid__item, .product, .product-block").each(async (_, el) => {
          const title = $(el).find("h2, h3, .title, .product-title").first().text().trim();
          const priceRaw = $(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, "");
          const price = parseFloat(priceRaw);
          const link = $(el).find("a").attr("href");
          const outOfStock = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");

          if (title && price > 5 && link && !outOfStock) {
            const analysis = getAnalysis(title, price);
            if (analysis && analysis.isDeal && !notified.has(link)) {
              notified.add(link);
              const shop = base.replace('https://', '').replace('www.', '');
              const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;

              const msg = `✅ **PROFITABLE DEAL**\n(${analysis.isCase ? '📦 CASE' : '🃏 SINGLE'})\n\n<b>${title}</b>\n🏪 ${shop}\n\n💰 **BUY:** £${price.toFixed(2)}\n🏷️ **RRP:** £${analysis.rrp.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n\n💸 **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n⏳ **STRATEGY:** ${analysis.strategy}\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

              await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
              });
            }
          }
        });
      } catch (e) { console.error(`Failed: ${base}`); }
      await wait(1000);
    }
  }
}

run().catch(console.error);
