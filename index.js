const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;

const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/itemId/";

let cache = {};
let lastUpdate = 0;

// -----------------------------
// FUNÇÃO DE PREÇO
// -----------------------------
async function getPrice(itemId) {
  if (cache[itemId]) return cache[itemId];

  try {
    const res = await axios.get(`${ORDERS_URL}${itemId}`);
    const orders = res.data.data || [];

    let prices = [];

    for (const o of orders) {
      const p = o.platinum ?? o.price;
      if (!p || p <= 0) continue;
      if (p > 1000) continue;
      prices.push(p);
    }

    if (!prices.length) return 0;

    prices.sort((a, b) => a - b);

    const final = Math.round(
      prices[0] * 0.6 + prices[Math.floor(prices.length / 2)] * 0.4
    );

    cache[itemId] = final;
    return final;

  } catch {
    return 0;
  }
}

// -----------------------------
// CACHE BACKGROUND (NÃO TRAVA SERVER)
// -----------------------------
async function updateCache() {
  try {
    const res = await axios.get(ITEMS_URL);
    const items = res.data.data || [];

    for (const item of items.slice(0, 200)) {
      await getPrice(item.id);
    }

    lastUpdate = Date.now();
    console.log("🔥 CACHE UPDATED");

  } catch (e) {
    console.log("❌ cache error");
  }
}

// roda sozinho
updateCache();
setInterval(updateCache, 1000 * 60 * 10); // 10 min

// -----------------------------
// SERVER (RÁPIDO - RENDER SAFE)
// -----------------------------
app.get("/", (req, res) => {
  res.send(`
    <h1>🔥 WARFRAME ENGINE ONLINE</h1>
    <p>Cache size: ${Object.keys(cache).length}</p>
    <p>Last update: ${new Date(lastUpdate).toLocaleTimeString()}</p>
    <p>Status: OK</p>
  `);
});

// IMPORTANTE: PORT BINDING
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});