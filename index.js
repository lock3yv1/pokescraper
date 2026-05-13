import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MARKET_DATA = {
  "151": { box: 185, bundle: 65, etb: 80, upc: 145, collection: 35, sleeved: 6.5, strategy: "Long Term 💎" },
  "evolving skies": { box: 850, etb: 200, sleeved: 18, strategy: "Long Term 💎" },
  "prismatic evolutions": { box: 230, etb: 105, bundle: 50, strategy: "Medium Term 📈" },
  "surging sparks": { box: 160, etb: 60, bundle: 62, sleeved: 5.5, strategy: "Short Term ⏱️" },
  "ascended heroes": { box: 185, etb: 85, bundle: 55, strategy: "Medium Term 📈" },
  "destined rivals": { box: 160, etb: 80, bundle: 70, strategy: "Medium Term 📈" },
  "twilight masquerade": { box: 125, etb: 45, bundle: 28, strategy: "Short Term ⏱️" },
  "temporal forces": { box: 115, etb: 40, bundle: 26, strategy: "Short Term ⏱️" },
  "lost origin": { box: 205, etb: 70, bundle: 45, strategy: "Long Term 💎" },
  "silver tempest": { box: 175, etb: 55, bundle: 40, strategy: "Long Term 💎" }
};

const RRP_MAP = { box: 144.99, etb: 49.99, bundle: 24.99, upc: 119.99, collection: 29.99, sleeved: 4.50 };

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = null;
  if (t.includes("booster box") || t.includes("display box")) type = "box";
  else if (t.includes("etb") || t.includes("trainer box")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("upc") || t.includes("ultra premium")) type = "upc";
  else if (t.includes("collection") || t.includes("poster") || t.includes("binder")) type = "collection";
  else if (t.includes("sleeved") && t.includes("booster")) type = "sleeved";
  
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
  const shipping = isCase ? 15 : 4;
  const netReturn = (totalMarket * 0.87); 
  const flip = (netReturn - price - shipping).toFixed(2);
  const margin = (((netReturn - shipping) / price) - 1) * 100;

  return { isCase, quantity, resell: totalMarket, flip, strategy: MARKET_DATA[setKey].strategy, isDeal: parseFloat(flip) > 2.50, margin: margin.toFixed(1) };
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  // Expanded selector list for varied shop themes
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .item, .product-wrap, .product-thumb, .box-product").each((_, el) => {
    const element = $(el);
    const title = element.find("h2, h3, h4, .product-title, .title, .name, .heading").first().text().trim();
    const priceRaw = element.find("[class*='price'], .amount, .money, .price-new").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceRaw);
    const link = element.find("a[href]").first().attr("href");
    
    const txt = element.text().toLowerCase();
    const outOfStock = txt.includes("sold out") || txt.includes("out of stock") || txt.includes("stock: 0");

    if (title && price > 5 && link && !outOfStock) {
      const url = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url });
    }
  });
  return items;
}

const RETAILERS = [
  "https://minisouk.com", "https://japan2uk.com", "https://thecardvault.co.uk",
  "https://doublesleeved.co.uk", "https://www.totalcards.net", "https://mytcg.co.uk",
  "https://hillscards.co.uk", "https://cosmiccollectables.co.uk", "https://thepokecave.co.uk",
  "https://geeky-zone.com", "https://chaos_cards.co.uk", "https://magicmadhouse.co.uk",
  "https://cardmarket.com/en/Pokemon", "https://brotherhoodgames.co.uk", "https://GatheringGames.co.uk",
  "https://PokemonPlug.com", "https://ZatuGames.co.uk", "https://WaylandGames.co.uk"
];

const QUERIES = ["pokemon+booster+box", "pokemon+etb", "pokemon+bundle", "pokemon+151", "sealed+case"];

async function run() {
  console.log(`🌐 MASS MARKET SCAN STARTING: ${RETAILERS.length} SHOPS...`);
  const notified = new Set();

  for (const base of RETAILERS) {
    for (const q of QUERIES) {
      for (let page = 1; page <= 3; page++) {
        const html = await fetchPage(`${base}/search?q=${q}&page=${page}`);
        if (!html) break;

        const items = extract(html, base);
        if (items.length === 0) break;

        for (const item of items) {
          const analysis = getAnalysis(item.title, item.price);
          if (analysis && analysis.isDeal && !notified.has(item.url)) {
            notified.add(item.url);
            const shop = base.replace('https://', '').split('.')[0];
            const msg = `💎 **POTENTIAL PROFIT**\n\n<b>${item.title}</b>\n🏪 ${shop}\n\n💰 **BUY:** £${item.price.toFixed(2)}\n📈 **MARKET:** £${analysis.resell.toFixed(2)}\n🏷️ **EST. FLIP:** £${analysis.flip}\n📊 **MARGIN:** ${analysis.margin}%\n\n👉 <a href="${item.url}">VIEW PRODUCT →</a>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
              method: "POST", headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
            });
          }
        }
        await wait(800);
      }
    }
  }
}

run().then(() => process.exit(0));
