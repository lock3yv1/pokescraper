// ingest.js — POSTs findings to Lock3y's Den ingest endpoint
// Drop this file next to index.js in the pokescraper repo.

const crypto = require("crypto");

const INGEST_URL =
  process.env.INGEST_URL ||
  "https://project--2ff9cdb1-a85d-4ae6-8a90-4f923d02c015.lovable.app/api/public/ingest";
const INGEST_SECRET = process.env.INGEST_SECRET;

// Map scraper rating label → DB enum
function mapRating(label) {
  if (!label) return "in_stock";
  if (label.includes("EXCEPTIONAL") || label.includes("EXCELLENT")) return "excellent";
  if (label.includes("GOOD")) return "good";
  if (label.includes("BREAK EVEN") || label.includes("AT MARKET")) return "fair";
  if (label.includes("SMALL LOSS") || label.includes("ABOVE")) return "above_market";
  if (label.includes("NOT WORTH")) return "overpriced";
  return "in_stock";
}

// Infer a coarse product_type from the title
function inferProductType(title) {
  const t = title.toLowerCase();
  if (t.includes("elite trainer box") || t.includes("etb")) return "elite trainer box";
  if (t.includes("booster bundle")) return "booster bundle";
  if (t.includes("half booster box") || t.includes("half box")) return "half booster box";
  if (t.includes("booster box")) return "booster box";
  if (t.includes("ultra premium collection") || t.includes("upc")) return "upc";
  if (t.includes("collection box")) return "collection box";
  if (t.includes("blister")) return "blister";
  if (t.includes("tin")) return "tin";
  if (t.includes("booster pack")) return "booster pack";
  return null;
}

function inferSetName(title, ENGLISH_SETS) {
  if (!ENGLISH_SETS) return null;
  const tn = title.toLowerCase();
  // Longest match wins so "Surging Sparks" beats "Sparks"
  const sorted = [...ENGLISH_SETS].sort((a, b) => b.length - a.length);
  for (const s of sorted) if (tn.includes(s.toLowerCase())) return s;
  return null;
}

/**
 * Push findings to the dashboard.
 * @param {Array} findings - results from runScan()
 * @param {Object} helpers - { getRRP, getMarket, getDealRating, ENGLISH_SETS }
 */
async function pushToIngest(findings, helpers = {}) {
  if (!INGEST_SECRET) {
    console.log("⚠️ No INGEST_SECRET — skipping dashboard push");
    return;
  }
  if (!findings || findings.length === 0) {
    console.log("  ⬜ No findings to push to dashboard");
    return;
  }

  const { getRRP, getMarket, getDealRating, ENGLISH_SETS } = helpers;

  const deals = findings.map((f) => {
    const buy = Number(f.price);
    const rrp = getRRP ? getRRP(f.title) : null;
    const market = getMarket ? getMarket(f.title) : null;
    const rating = getDealRating ? getDealRating(buy, rrp, market) : null;
    const delta = market ? ((buy - market) / market) * 100 : null;

    return {
      title: f.title,
      set_name: inferSetName(f.title, ENGLISH_SETS),
      product_type: inferProductType(f.title),
      retailer: f.retailer,
      url: f.url,
      image_url: f.image && f.image.startsWith("http") ? f.image : null,
      buy_price: Number(buy.toFixed(2)),
      rrp: rrp != null ? Number(rrp) : null,
      market_price: market != null ? Number(market) : null,
      market_delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
      rating: mapRating(rating && rating.label),
      scraped_at: new Date().toISOString(),
    };
  });

  // Chunk to stay under the 500-deal payload limit
  const chunks = [];
  for (let i = 0; i < deals.length; i += 400) chunks.push(deals.slice(i, i + 400));

  let total = 0;
  for (const chunk of chunks) {
    const body = JSON.stringify({ deals: chunk });
    const signature = crypto
      .createHmac("sha256", INGEST_SECRET)
      .update(body)
      .digest("hex");

    try {
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ingest-signature": signature,
        },
        body,
      });
      const txt = await res.text();
      if (res.ok) {
        total += chunk.length;
        console.log(`  ✅ Ingest: ${chunk.length} deals → ${txt}`);
      } else {
        console.log(`  ❌ Ingest ${res.status}: ${txt}`);
      }
    } catch (e) {
      console.log(`  ❌ Ingest fetch error: ${e.message}`);
    }
  }
  console.log(`📡 Pushed ${total}/${deals.length} deals to dashboard`);
}

module.exports = { pushToIngest };