import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. THE TRUTH TABLE
const MARKET_DATA = {
  "151": { box: 190, bundle: 70, etb: 85, upc: 150, strategy: "Long Term 💎" },
  "evolving skies": { box: 880, etb: 210, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 235, etb: 110, bundle: 55, strategy: "High Demand 🔥" },
  "surging sparks": { box: 165, etb: 65, bundle: 65, strategy: "Medium Term 📈" },
  "ascended heroes": { box: 190, etb: 90, bundle: 60, strategy: "Medium Term 📈" },
  "destined rivals": { box: 165, etb: 85, bundle: 75, strategy: "Medium Term 📈" },
  "chaos rising": { box: 155, etb: 55, bundle: 32, strategy: "New Release 🚀" }
};

const RETAILERS = [
  "https://japan2uk.com", "https://thecardvault.co.uk", "https://doublesleeved.co.uk",
  "https://mytcg.co.uk", "https://hillscards.co.uk", "https://cosmiccollectables.co.uk",
  "https://thepokecave.co.uk", "https://geeky-zone.com", "https://brotherhoodgames.co.uk",
  "https://gatheringgames.co.uk", "https://pokemonplug.com", "https://totalcards.net",
  "https://minisouk.com"
];

// Helper to analyze the deal
function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : null;
  if (!type) return null;

  let setKey = null;
  for (const set in MARKET_DATA) { if (t.includes(set)) { setKey = set; break; } }
  if (!setKey) return null;

  const resell = MARKET_DATA[setKey][type];
  const net = (resell * 0.87) - price - 4; // 13% fees, £4 ship
  
  return { 
    resell, 
    flip: net.toFixed(2), 
    isDeal: net > 2.00, 
    strategy: MARKET_DATA[setKey].strategy 
  };
}

async function run() {
  console.log("🚀 ENGINE STARTED: Scanning for stock...");
  
  // HEARTBEAT: Tell Telegram we are alive
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: "🤖 Scraper is ONLINE and searching..." })
  });

  for (const base of RETAILERS) {
    console.log(`🔎 Checking: ${base}`);
    try {
      const res = await fetch(`${base}/search?q=pokemon`, { 
        headers: { "User-Agent": "Mozilla/5.0" } 
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $(".product-card, .product-item, .grid__item, .product").each(async (_, el) => {
        const title = $(el).find("h2, h3, .title").text().trim();
        const price = parseFloat($(el).find(".price, .money, .amount").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");

        if (title && price && !$(el).text().toLowerCase().includes("sold out")) {
          const analysis = getAnalysis(title, price);
          
          // CRITICAL: We are pinging EVERY match now so you can see it working
          if (analysis) {
            const status = analysis.isDeal ? "✅ DEAL" : "❌ NO MARGIN";
            const msg = `${status}\n<b>${title}</b>\n💰 Buy: £${price}\n📈 Market: £${analysis.resell}\n🏷️ Flip: £${analysis.flip}\n\n<a href="${base}${link}">Link</a>`;
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
            });
          }
        }
      });
    } catch (e) { console.error(`Error on ${base}`); }
    await wait(1000);
  }
}

// THE SPARK: This actually runs the code
run().catch(console.error);
