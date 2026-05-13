import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// RE-CALIBRATED MARKET DATA (May 13, 2026)
const MARKET_DATA = {
  "151": { box: 215, bundle: 85, etb: 115, upc: 185, collection: 45, strategy: "Restock Priority 🚨" },
  "evolving skies": { box: 2200, etb: 515, bundle: 185, strategy: "Grail 💎" },
  "prismatic evolutions": { box: 245, etb: 180, bundle: 68, strategy: "High Demand 🔥" },
  "surging sparks": { box: 175, etb: 70, bundle: 70, strategy: "Mainline 📈" },
  "chaos rising": { box: 180, etb: 55, bundle: 35, strategy: "Upcoming Drop 🚀" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, collection: 29.99 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  else if (t.includes("collection")) type = "collection";
  
  if (!type) return null;

  let setKey = null;
  for (const set in MARKET_DATA) { if (t.includes(set)) { setKey = set; break; } }
  if (!setKey) return null;

  let quantity = 1;
  const isCase = t.includes("case") || t.includes("sealed case");
  if (isCase) {
    const qtyMatch = t.match(/\((\d+)\)/) || t.match(/(\d+)\s*x/) || t.match(/case of (\d+)/);
    quantity = qtyMatch ? parseInt(qtyMatch[1]) : (type === "box" ? 6 : (type === "etb" || type === "bundle" ? 10 : 1));
  }

  const unitMarket = MARKET_DATA[setKey][type];
  const totalMarket = unitMarket * quantity;
  const shipping = isCase ? 18 : 4;
  const netReturn = (totalMarket * 0.86); 
  const flip = (netReturn - price - shipping).toFixed(2);
  const margin = (((netReturn - shipping) / price) - 1) * 100;

  return { isCase, quantity, resell: totalMarket, flip, margin: margin.toFixed(1), strategy: MARKET_DATA[setKey].strategy, isDeal: parseFloat(flip) > 5.00 };
}

const RETAILERS = [
  "https://japan2uk.com", "https://thecardvault.co.uk", "https://doublesleeved.co.uk",
  "https://mytcg.co.uk", "https://hillscards.co.uk", "https://cosmiccollectables.co.uk",
  "https://totalcards.net", "https://minisouk.com", "https://gatheringgames.co.uk",
  "https://pokemonplug.com", "https://thecardpost.co.uk", "https://titancards.co.uk"
];

async function run() {
  console.log("🚀 EMERGENCY RECOVERY: Scanning started...");
  const notified = new Set();

  for (const base of RETAILERS) {
    try {
      // Rotating the search query to keep the scrapers fresh
      const searchUrl = `${base}/search?q=pokemon+151&sort_by=created-descending`;
      
      const res = await fetch(searchUrl, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-GB,en;q=0.9"
        } 
      });

      if (!res.ok) {
        console.log(`⚠️ Shop blocked or down: ${base}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      $(".product-card, .product-item, .grid__item, .product, .item").each(async (_, el) => {
        const title = $(el).find("h2, h3, .title, .product-title").first().text().trim();
        const price = parseFloat($(el).find(".price, .money, .amount").first().text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");
        const oos = $(el).text().toLowerCase().includes("sold out") || $(el).text().toLowerCase().includes("out of stock");

        if (title && price > 10 && link && !oos) {
          const analysis = getAnalysis(title, price);
          if (analysis && (analysis.isDeal || analysis.isCase) && !notified.has(link)) {
            notified.add(link);
            const fullLink = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
            
            const msg = `🔥 **BACK ONLINE: DEAL FOUND**\n(${analysis.isCase ? `📦 CASE OF ${analysis.quantity}` : '🃏 SINGLE'})\n\n<b>${title}</b>\n🏪 ${base.replace('https://','').split('.')[0]}\n\n💰 **BUY:** £${price.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n🏷️ **FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n\n👉 <a href="${fullLink}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
          }
        }
      });
    } catch (e) {
      console.error(`Error on ${base}: ${e.message}`);
    }
    await wait(2500); // Respectful crawl to prevent temporary IP bans
  }
}

run().catch(console.error);
