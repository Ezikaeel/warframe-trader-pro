const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// API
// -----------------------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/itemId/";

// -----------------------------
// CACHE PERSISTENTE (DISCO)
// -----------------------------
const CACHE_FILE = "./price-cache.json";

let priceCache = {};

if (fs.existsSync(CACHE_FILE)) {
  priceCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

// salva cache
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(priceCache, null, 2));
}

// -----------------------------
// FILA ANTI 429 (CRÍTICO)
// -----------------------------
let queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    await job();

    // delay obrigatório anti ban
    await sleep(400);
  }

  processing = false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// -----------------------------
// PRICE FETCH SEGURO
// -----------------------------
function fetchPrice(itemId) {
  return new Promise((resolve) => {

    if (priceCache[itemId] !== undefined) {
      return resolve(priceCache[itemId]);
    }

    queue.push(async () => {
      try {
        const res = await axios.get(`${ORDERS_URL}${itemId}`, {
          headers: {
            "User-Agent": "warframe-trader-pro"
          }
        });

        const orders = res.data.data || [];

        let prices = [];

        for (const o of orders) {
          const p = o.platinum ?? o.price;
          if (!p || p <= 0 || p > 1000) continue;
          prices.push(p);
        }

        if (!prices.length) {
          priceCache[itemId] = 0;
          return resolve(0);
        }

        prices.sort((a, b) => a - b);

        const final =
          prices[0] * 0.6 +
          prices[Math.floor(prices.length / 2)] * 0.4;

        const value = Math.round(final);

        priceCache[itemId] = value;

        saveCache();

        resolve(value);

      } catch (err) {
        if (err.response?.status === 429) {
          console.log("⚠️ RATE LIMIT DETECTADO");
        }

        resolve(0);
      }
    });

    processQueue();
  });
}

// -----------------------------
// ITEMS
// -----------------------------
async function fetchItems() {
  const res = await axios.get(ITEMS_URL);
  return res.data.data || [];
}

// -----------------------------
// CATEGORY SIMPLE
// -----------------------------
function getCategory(item) {
  const tags = (item.tags || []).map(t => t.toLowerCase());

  if (tags.includes("prime") && tags.includes("warframe")) return "WARFRAME_PRIME_SET";
  if (tags.includes("prime") && tags.includes("weapon")) return "WEAPON_PRIME_SET";
  if (tags.includes("arcane") || tags.includes("arcane_enhancement")) return "ARCANES";
  if (tags.includes("mod")) return "MODS";

  return "OTHER";
}

// -----------------------------
// ENGINE (SAFE)
// -----------------------------
async function build() {
  const items = await fetchItems();

  const grouped = {
    WARFRAME_PRIME_SET: [],
    WEAPON_PRIME_SET: [],
    ARCANES: [],
    MODS: [],
    OTHER: []
  };

  // 🔥 LIMITA PRA NÃO EXPLODIR API
  const limited = items.slice(0, 150);

  for (const item of limited) {
    const price = await fetchPrice(item.id);

    grouped[getCategory(item)].push({
      name: item.slug.replace(/_/g, " "),
      price
    });
  }

  return grouped;
}

// -----------------------------
// HTML UI
// -----------------------------
app.get("/", async (req, res) => {

  const data = await build();

  let html = `
  <html>
  <head>
    <title>Warframe Farm Dashboard</title>
    <style>
      body { font-family: Arial; background:#0f0f0f; color:#fff; padding:20px; }
      .cat { margin:20px 0; padding:15px; border:1px solid #333; border-radius:10px; }
      .item { margin:5px 0; }
      .price { color:#00ff88; }
    </style>
  </head>
  <body>
  <h1>🔥 WARFRAME FARM DASHBOARD</h1>
  `;

  for (const [cat, list] of Object.entries(data)) {

    const top = list
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);

    html += `<div class="cat"><h2>${cat}</h2>`;

    for (const item of top) {
      html += `
        <div class="item">
          🔥 ${item.name} → 
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
// SERVER (RENDER SAFE)
// -----------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 ONLINE PORT:", PORT);
});