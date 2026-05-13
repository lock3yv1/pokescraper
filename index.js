import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback pricing so the bot never ignores a product
const RRP_DEFAULTS = { "box": 144.99, "etb": 49.99, "bundle": 24.99, "pack": 4.49, "upc": 119.99, "tin": 24.99 };
const EXCLUDE = ["japanese", "jp", "korean", "chinese", "sleeve", "binder", "playmat", "digital", "code"];

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  if (EXCLUDE.some(k => t.includes(k))) return null;

  // Determine Type for RRP calculation
  let type = "box";
  if (t.includes("etb") || t.includes("trainer")) type = "etb";
  else if (t.includes("bundle")) type = "bundle";
  else if (t.includes("pack")) type = "pack";
  else if (t.includes("upc") || t.includes("ultra")) type = "upc";
  else if (t.includes("tin")) type = "tin";
  
  const rrpVal = RRP_DEFAULTS[type] || 144.99;
  const diff = Math.round(((price - rrpVal) / rrpVal) * 100);
  
  // Dynamic Resell: Assumes 20% profit margin if set is unknown
  const estResell = rrpVal * 1.2;
  const flip = (estResell - price - (estResell * 0.13) - 4).toFixed(2);

  return { rrp: rrpVal, resell: estResell, diff, flip };
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
  // Massive selector list to catch products on ANY shop layout
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .item, .product-layout, .product-grid-item, .product-listing").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name, .product-name").first().text().trim();
    const priceText = $(el).find("[class*='price'], .amount, .money, .current-price").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = $(el).find("a[href]").first().attr("href");
    
    if (title && price > 3 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const url = link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url });
    }
  });
  return items;
}

const RETAILERS = [
  { name: "Miniso", url: "https://minisouk.com/collections/pokemon" },
  { name: "Japan2UK", url: "https://japan2uk.com/collections/pokemon-english" },
  { name: "The Card Vault", url: "https://thecardvault.co.uk/collections/pokemon-sealed-product" },
  { name: "Double Sleeved", url: "https://doublesleeved.co.uk/collections/pokemon" },
  { name: "Total Cards", url: "https://www.totalcards.net/pokemon/sealed-product" },
  { name: "My TCG", url: "https://mytcg.co.uk/collections/pokemon-sealed-product" }
];

async function run() {
  console.log(`🚀 FORCING FULL SCRAPE: ${new Date().toLocaleTimeString()}`);
  const notified = new Set();

  for (const shop of RETAILERS) {
    console.log(`  → Crawling ${shop.name}...`);
    const html = await fetchPage(shop.url);
    if (!html) { console.log(`    ⚠️ Connection Blocked`); continue; }

    const items = extract(html, shop.url);
    console.log(`    Found ${items.length} items total`);

    for (const item of items) {
      if (notified.has(item.url)) continue;
      
      const analysis = getAnalysis(item.title, item.price);
      if (analysis) {
        notified.add(item.url);
        const emoji = analysis.diff <= 5 ? "🔥" : "❌";
        const msg = `${emoji} <b>${item.title}</b>\n🏪 ${shop.name}\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${analysis.rrp} (${analysis.diff > 0 ? "+" : ""}${analysis.diff}%)\n📈 EST RESELL: £${analysis.resell.toFixed(2)}\n🏷️ FLIP: £${analysis.flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
          method: "POST", headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
        });
      }
    }
    await wait(2000); // 2s pause to stay stealthy
  }
}

run().then(() => { console.log("✅ Scan Done."); process.exit(0); });
