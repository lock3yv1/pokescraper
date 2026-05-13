import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "chaos rising": { box: 155, etb: 55, bundle: 32, strategy: "New Release 🚀" }, // Drops May 22
  "151": { box: 190, bundle: 72, etb: 85, upc: 155, strategy: "Restock Priority 🚨" },
  "evolving skies": { box: 880, etb: 210, strategy: "Grail 💎" },
  "prismatic evolutions": { box: 235, etb: 115, bundle: 58, strategy: "High Demand 🔥" },
  "surging sparks": { box: 165, etb: 65, bundle: 65, strategy: "Mainline 📈" }
};

const RETAILERS = [
  // High Priority: Frequent Restockers
  "https://www.smyths toys.com/uk/en-gb/search/?text=pokemon", 
  "https://www.argos.co.uk/search/pokemon-cards/",
  "https://www.pokemoncenter.com/en-gb/category/trading-card-game",
  "https://www.game.co.uk/en/trading-cards/pokemon/",
  "https://www.toyspany.com/pokemon",
  // Specialist TCG Shops (Broad Coverage)
  "https://www.magicmadhouse.co.uk", "https://www.chaoscards.co.uk", "https://www.totalcards.net", 
  "https://www.zatu.co.uk", "https://www.waylandgames.co.uk", "https://japan2uk.com",
  "https://thecardvault.co.uk", "https://doublesleeved.co.uk", "https://mytcg.co.uk",
  "https://hillscards.co.uk", "https://cosmiccollectables.co.uk", "https://thepokecave.co.uk",
  "https://geeky-zone.com", "https://brotherhoodgames.co.uk", "https://gatheringgames.co.uk",
  // The "Hidden" Sellers
  "https://www.waterstones.com/category/toys-games/pokemon", "https://www.hamleys.com/pokemon",
  "https://www.johnlewis.com/search?search-term=pokemon+cards", "https://www.selfridges.com/GB/en/cat/?freeText=pokemon",
  "https://www.menkind.co.uk/search-results?q=pokemon", "https://www.forbiddenplanet.com/catalog/?q=pokemon",
  "https://www.jarrolds.co.uk/search?q=pokemon", "https://www.whsmith.co.uk/search/?q=pokemon"
];

async function run() {
  console.log(`🛰️ SNIPER ACTIVE: Monitoring 40 UK Retailers...`);
  const notified = new Set();

  for (const url of RETAILERS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..." } });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      // Scrape Logic (Generic Selectors to fit more shops)
      $(".product, .item, .card, .grid-item").each((_, el) => {
        const title = $(el).find("[class*='title'], h2, h3").text().trim();
        const price = parseFloat($(el).find("[class*='price']").text().replace(/[^0-9.]/g, ""));
        const link = $(el).find("a").attr("href");
        
        // CHECK IF IN STOCK (Skip if the card says "Sold Out")
        if (title && price && !$(el).text().toLowerCase().includes("sold out")) {
          const analysis = getAnalysis(title, price); // From previous version
          if (analysis && analysis.isDeal) {
             // PING TELEGRAM
          }
        }
      });
    } catch (e) { console.log(`Skipping shop due to error: ${url}`); }
    await wait(500); // Quick rotation
  }
}
