import * as cheerio from 'cheerio';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper for delays to prevent getting blocked
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RRP = {
  "booster box": 144.99, "elite trainer box": 49.99, "etb": 49.99,
  "half box": 74.99, "booster bundle": 24.99, "booster pack": 4.49,
  "mini tins": 44.99, "collection box": 34.99, "poster collection": 19.99,
  "upc": 119.99, "ultra premium": 119.99, "tin": 24.99
};

const RESELL = {
  "151 booster box": 180, "151 booster bundle": 55, "151 elite trainer box": 70,
  "prismatic evolutions booster box": 220, "prismatic evolutions etb": 95,
  "surging sparks booster box": 155, "evolving skies booster box": 800,
  "perfect order elite trainer box": 60, "journey together booster box": 120
};

const PRODUCT_KEYWORDS = ["booster box","elite trainer box","etb","booster bundle","booster pack","collection box","tin","blister","upc"];
const EXCLUDE = ["yugioh","mtg","magic","lorcana","single","graded","psa","sleeve","playmat","binder","japanese","jp","korean"];

function isValid(title) {
  const t = title.toLowerCase();
  if (EXCLUDE.some(k => t.includes(k))) return false;
  return PRODUCT_KEYWORDS.some(k => t.includes(k)) && (t.includes("pokemon") || t.includes("pokémon"));
}

function getMatch(title, list) {
  const t = title.toLowerCase();
  let best = null;
  for (const [k, v] of Object.entries(list)) {
    if (t.includes(k) && (!best || k.length > best.k.length)) best = { k, v };
  }
  return best ? best.v : null;
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } 
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extractProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  // Expanded selectors to catch almost any shopify or custom UK hobby site
  $(".product-item, .product-card, .grid__item, .card-wrapper, .product-block, .product, .col-sm-4, .product-grid-item, .item, .product-layout").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .product-title, .title, .name").first().text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find("[class*='price'], .amount, .current-price, .price").first().text().replace(/[^0-9.]/g, "");
    const price = parseFloat(priceText);
    const link = $(el).find("a[href]").first().attr("href");
    if (title && price > 1 && link && !$(el).text().toLowerCase().includes("sold out")) {
      const fullUrl = link.startsWith("http") ? link : `${new URL(baseUrl).origin}${link.startsWith('/') ? '' : '/'}${link}`;
      items.push({ title, price, url: fullUrl });
    }
  });
  return items;
}

const RETAILERS = [
  { name: "Miniso", url: "https://minisouk.com/search?q=pokemon+sealed" },
  { name: "Total Cards", url: "https://www.totalcards.net/search?q=pokemon+sealed" },
  { name: "Japan2UK", url: "https://japan2uk.com/search?q=pokemon+english" },
  { name: "Titan Cards", url: "https://www.titancards.co.uk/search?q=pokemon+sealed" },
  { name: "Double Sleeved", url: "https://www.doublesleeved.co.uk/search?q=pokemon+sealed" },
  { name: "The Card Vault", url: "https://thecardvault.co.uk/search?q=pokemon+sealed" },
  { name: "Magic Madhouse", url: "https://magicmadhouse.co.uk/search?q=pokemon+sealed" },
  { name: "Chaos Cards", url: "https://www.chaoscards.co.uk/search?q=pokemon+sealed" },
  { name: "Zatu Games", url: "https://www.board-game.co.uk/search?q=pokemon+sealed" },
  { name: "Pokemon Center UK", url: "https://www.pokemoncenter.com/en-gb/search/pokemon-sealed" },
  { name: "Hills Cards", url: "https://www.hillscards.co.uk/search?q=pokemon+sealed" },
  { name: "Gathering Games", url: "https://www.gatheringgames.com/search?q=pokemon+sealed" },
  { name: "Wayland Games", url: "https://www.waylandgames.co.uk/search?q=pokemon+sealed" },
  { name: "Cosmic Col.", url: "https://cosmiccollectables.co.uk/search?q=pokemon+sealed" },
  { name: "My TCG", url: "https://mytcg.co.uk/search?q=pokemon+sealed" }
];

async function runScan() {
  console.log(`🚀 MEGA SCAN (15 Sites) Started: ${new Date().toLocaleTimeString()}`);
  const notified = new Set();

  for (const shop of RETAILERS) {
    console.log(`  → Checking ${shop.name}...`);
    const html = await fetchPage(shop.url);
    if (!html) { console.log(`    ⚠️ Blocked or Offline`); continue; }
    
    const items = extractProducts(html, shop.url);
    console.log(`    Found ${items.length} potential items`);

    for (const item of items) {
      if (isValid(item.title) && !notified.has(item.url)) {
        const rrp = getMatch(item.title, RRP);
        const resell = getMatch(item.title, RESELL);

        if (rrp && resell) {
          notified.add(item.url);
          const diff = Math.round(((item.price - rrp) / rrp) * 100);
          const flip = (resell - item.price - (resell * 0.13) - 4).toFixed(2);
          const score = diff <= 5 ? "🔥 DEAL" : "❌ OVERPRICED";

          const msg = `${score}\n\n<b>${item.title}</b>\n🏪 ${shop.name}\n💰 BUY: £${item.price.toFixed(2)}\n📊 RRP: £${rrp.toFixed(2)} (${diff > 0 ? "+" : ""}${diff}%)\n📈 RESELL: £${resell.toFixed(2)}\n🏷️ FLIP: £${flip}\n\n👉 <a href="${item.url}">BUY NOW →</a>`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }) 
          });
        }
      }
    }
    await wait(1500); // 1.5s gap between shops to avoid IP bans
  }
}

runScan().then(() => { console.log("✅ All Retailers Checked."); process.exit(0); });
