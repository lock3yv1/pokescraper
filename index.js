import fetch from 'node-fetch';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- 2026 MASTER MARKET DATABASE ---
const MARKET_DATA = {
  "chaos rising": { 
    box: 155.00, etb: 50.00, bundle: 28.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/chaos-rising/logo.png",
    url: "https://www.pokemoncenter.com/en-gb/category/chaos-rising"
  },
  "perfect order": { 
    box: 148.00, etb: 45.00, bundle: 30.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/perfect-order/logo.png",
    url: "https://www.pokemoncenter.com/en-gb/category/perfect-order"
  },
  "ascended heroes": { 
    box: 240.00, etb: 115.00, bundle: 45.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/ascended-heroes/logo.png",
    url: "https://www.pokemoncenter.com/en-gb/category/ascended-heroes"
  },
  "destined rivals": { 
    box: 148.00, etb: 55.00, bundle: 32.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/destined-rivals/logo.png",
    url: "https://www.pokemoncenter.com/en-gb/category/destined-rivals"
  },
  "abyss eye": { 
    box: 165.00, etb: 68.00, bundle: 35.00, 
    img: "https://tcg.pokemon.com/assets/img/expansions/abyss-eye/logo.png",
    url: "https://www.pokemoncenter.com/en-gb/category/abyss-eye"
  }
};

async function sendRichAlert(title, price, analysis) {
  const caption = `📊 **MARKET INTEL REPORT**\n\n` +
    `📦 **ITEM:** ${title}\n` +
    `💰 **LIST PRICE:** £${price.toFixed(2)}\n` +
    `📈 **MARKET VALUE:** £${analysis.market.toFixed(2)}\n` +
    `📉 **DELTA:** -${analysis.delta}% Below Market\n` +
    `💸 **NET PROFIT:** £${analysis.profit}\n\n` +
    `🔥 **RATING:** ${analysis.rating}`;

  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    photo: analysis.img,
    caption: caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: "🛒 BUY NOW", url: analysis.url }]]
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
  const rating = parseFloat(profit) > 30 ? "💎 GRAIL" : "🚀 STEAL";

  return (parseFloat(profit) > 5.00) ? { 
    market, profit, delta, rating, 
    img: MARKET_DATA[setKey].img, 
    url: MARKET_DATA[setKey].url 
  } : null;
}

async function run() {
  console.log("🚀 Launching PokeScraper 2026: Total War Edition...");
  const feed = [
    { name: "Pokemon Chaos Rising Booster Box", price: 110.00 },
    { name: "Pokemon Destined Rivals Booster Box", price: 105.00 },
    { name: "Pokemon Abyss Eye ETB", price: 45.00 }
  ];

  for (const item of feed) {
    const analysis = getAnalysis(item.name, item.price);
    if (analysis) {
      console.log(`✅ Pinging: ${item.name}`);
      await sendRichAlert(item.name, item.price, analysis);
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });
