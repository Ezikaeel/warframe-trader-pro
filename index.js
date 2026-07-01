const express = require("express");
const axios = require("axios");

const app = express();

// -----------------------------
// CONFIG
// -----------------------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/itemId/";

const PORT = process.env.PORT || 3000;

// -----------------------------
// CACHE
// -----------------------------
let itemsCache = [];
let priceCache = {};

// -----------------------------
// FETCH ITEMS
// -----------------------------
async function fetchItems() {
  const res = await axios.get(ITEMS_URL);
  return res.data.data || [];
}

// -----------------------------
// CATEGORY (TAGS SIMPLES)
// -----------------------------
function getCategory(item) {
  const tags = (item.tags || []).map(t => t.toLowerCase());

  if (tags.includes("prime") && tags.includes("warframe")) {
    return "WARFRAME_PRIME_SET";
  }

  if (tags.includes("prime") && tags.includes("weapon")) {
    return "WEAPON_PRIME_SET";
  }

  if (tags.includes("mod")) {
    if (tags.includes("archon")) return "MOD_ARCHON";
    if (tags.includes("riven")) return "MOD_RIVEN";
    return "MODS";
  }

  if (tags.includes("arcane") || tags.includes("arcane_enhancement")) {
    return "ARCANES";
  }

  return "OTHER";
}

// -----------------------------
// PRICE ENGINE INTELIGENTE
// -----------------------------
async function getPrice(itemId) {
  if (priceCache[itemId] !== undefined) {
    return priceCache[itemId];
  }

  try {
    const res = await axios.get(`${ORDERS_URL}${itemId}`);

    const orders = res.data.data || [];

    let prices = [];

    for (const o of orders) {
      const price = o.platinum ?? o.price;

      if (!price || price <= 0) continue;
      if (price > 1000) continue;

      prices.push(price);
    }

    if (prices.length === 0) {
      priceCache[itemId] = 0;
      return 0;
    }

    prices.sort((a, b) => a - b);

    const lowest = prices[0];
    const median = prices[Math.floor(prices.length / 2)];

    const finalPrice = Math.round((lowest * 0.6) + (median * 0.4));

    priceCache[itemId] = finalPrice;

    return finalPrice;

  } catch (err) {
    priceCache[itemId] = 0;
    return 0;
  }
}

// -----------------------------
// ENGINE BUILD
// -----------------------------
async function buildEngine() {
  const items = await fetchItems();

  const grouped = {
    WARFRAME_PRIME_SET: [],
    WEAPON_PRIME_SET: [],
    MOD_ARCHON: [],
    MOD_RIVEN: [],
    MODS: [],
    ARCANES: [],
    OTHER: []
  };

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = getCategory(item);
    const price = await getPrice(id);

    grouped[category].push({
      name: item.slug,
      price
    });
  }

  return grouped;
}

// -----------------------------
// ROUTE HTML (INTERFACE)
// -----------------------------
app.get("/", async (req, res) => {
  const data = await buildEngine();

  let html = `
  <html>
  <head>
    <title>Warframe Farm Dashboard</title>
    <style>
      body { font-family: Arial; background:#111; color:#fff; padding:20px; }
      .cat { margin-top:30px; padding:10px; border:1px solid #333; border-radius:10px; }
      .item { margin:5px 0; }
      .price { color: #00ff99; }
    </style>
  </head>
  <body>
  <h1>🔥 WARFRAME FARM DASHBOARD</h1>
  `;

  for (const [cat, list] of Object.entries(data)) {
    html += `<div class="cat"><h2>${cat}</h2>`;

    const top = list
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);

    for (const item of top) {
      html += `
        <div class="item">
          🔥 ${item.name} - 
          <span class="price">${item.price}p</span>
        </div>
      `;
    }

    html += `</div>`;
  }

  html += `</body></html>`;

  res.send(html);
});

// -----------------------------
// SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});