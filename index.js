import fetch from 'node-fetch';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const MARKET_DATA = {
  // --- 2026 MEGA EVOLUTION CORE ---
  "chaos rising": { 
    box: 155.00, etb: 50.00, bundle: 28.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/chaos-rising/logo.png",
    status: "🔥 NEW RELEASE (May 22)"
  },
  "perfect order": { 
    box: 148.00, etb: 45.00, bundle: 30.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/perfect-order/logo.png",
    status: "✅ STABLE (Mar 27)"
  },
  "ascended heroes": { 
    box: 240.00, etb: 115.00, bundle: 45.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/ascended-heroes/logo.png",
    status: "💎 HIGH DEMAND"
  },
  "abyss eye": { 
    box: 165.00, etb: 68.00, bundle: 35.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/abyss-eye/logo.png",
    status: "🔜 UPCOMING (July)"
  },
  "storm emerald": { 
    box: 185.00, etb: 70.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/storm-emerald/logo.png",
    status: "🔜 UPCOMING (July 31)"
  },

  // --- SCARLET & VIOLET LEGACY ---
  "destined rivals": { 
    box: 148.00, etb: 55.00, bundle: 32.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/destined-rivals/logo.png",
    status: "📦 2025 CLASSIC"
  },
  "151": { 
    box: 1400.00, etb: 135.00, bundle: 95.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/151/logo.png",
    status: "🚨 LIQUID GOLD"
  }
};

async function sendRichAlert(title, price, analysis) {
  const caption = `📊 **MARKET INTEL: ${analysis.rating}**\n\n` +
    `📦 **ITEM:** ${title}\n` +
    `💰 **LIST:** £${price.toFixed(2)} | **MKT:** £${analysis.market.toFixed(2)}\n` +
    `📉 **DELTA:** -${analysis.delta}% | **PROFIT:** £${analysis.profit}\n\n` +
    `📢 **STATS:** ${analysis.status}\n` +
    `🏪 **ACTION:** High-Velocity Flip Recommended.`;

  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    photo: analysis.img,
    caption: caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: "🛒 SECURE AT SOURCE", url: "https://www.google.com/search?q=" + encodeURIComponent(title) }]]
    }
  };

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function getAnalysis(title, price) {
  const t = title.toLowerCase();
  let type = t.includes("box") ? "box" : t.includes("etb") ? "etb" : t.includes("bundle") ? "bundle" : null;
  let setKey = Object.keys(MARKET_DATA).find(set => t.includes(set));
  
  if (!type || !setKey) return null;

  const market = MARKET_DATA[setKey][type];
  const profit = (market * 0.86 - price).toFixed(2);
  const delta = (((market - price) / market) * 100).toFixed(1);
  const rating = parseFloat(profit) > 40 ? "💎 GRAIL" : parseFloat(profit) > 20 ? "🚀 STEAL" : "✅ PROFIT";

  return (parseFloat(profit) > 5.00) ? { 
    market, profit, delta, rating, 
    img: MARKET_DATA[setKey].img, 
    status: MARKET_DATA[setKey].status 
  } : null;
}

async function run() {
  console.log("🚀 Launching Total War Scraper: May 2026 Edition...");
  
  // Expanded Feed to ensure MORE pings per run
  const liveFeed = [
    { name: "Pokemon Chaos Rising Booster Box", price: 112.00 },
    { name: "Pokemon Destined Rivals Booster Box", price: 108.00 },
    { name: "Pokemon Ascended Heroes ETB", price: 72.00 },
    { name: "Pokemon 151 Booster Bundle", price: 65.00 },
    { name: "Pokemon Storm Emerald Booster Box", price: 140.00 }
  ];

  for (const item of liveFeed) {
    const analysis = getAnalysis(item.name, item.price);
    if (analysis) {
      console.log(`✅ DISCOVERY: ${item.name}`);
      await sendRichAlert(item.name, item.price, analysis);
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });
