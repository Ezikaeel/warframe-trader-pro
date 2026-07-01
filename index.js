const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();

// 🔥 IMPORTANTE: Render fornece a porta automaticamente
const PORT = process.env.PORT || 3000;

// ---------------- CACHE FILES ----------------
const CACHE_ITEMS = "./cache_items.json";
const CACHE_RECENT = "./cache_recent.json";

// ---------------- HELPERS ----------------
function loadCache(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveCache(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------------- API ----------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const RECENT_URL = "https://api.warframe.market/v2/orders/recent";

// ---------------- CACHE UPDATE ----------------
async function updateItemsCache() {
  try {
    const res = await axios.get(ITEMS_URL, {
      headers: { "User-Agent": "warframe-engine" }
    });

    saveCache(CACHE_ITEMS, res.data.data || []);
    console.log("📦 Items cache atualizado");
  } catch (err) {
    console.log("❌ erro items cache:", err.message);
  }
}

async function updateRecentCache() {
  try {
    const res = await axios.get(RECENT_URL, {
      headers: { "User-Agent": "warframe-engine" }
    });

    saveCache(CACHE_RECENT, res.data.data || []);
    console.log("💰 Recent cache atualizado");
  } catch (err) {
    console.log("❌ erro recent cache:", err.message);
  }
}

// ---------------- PRICE LOGIC ----------------
function getPriceFromRecent(id, recent) {
  for (const o of recent || []) {
    if (o.item_id === id) {
      return o.platinum || 0;
    }
  }
  return null;
}

async function getPriceFallback(id) {
  try {
    const res = await axios.get(
      `https://api.warframe.market/v2/orders/itemId/${id}`,
      { headers: { "User-Agent": "warframe-engine" } }
    );

    const orders = res.data.data || [];

    let min = null;

    for (const o of orders) {
      const price = o.platinum || 0;
      if (!min || price < min) min = price;
    }

    return min || 0;
  } catch {
    return 0;
  }
}

// ---------------- ENGINE ----------------
async function buildDashboard() {
  const items = loadCache(CACHE_ITEMS) || [];
  const recent = loadCache(CACHE_RECENT) || [];

  const grouped = {};

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const name = item.slug || "unknown";

    const category = (item.tags || []).includes("prime")
      ? "PRIME"
      : "OTHER";

    let price = getPriceFromRecent(id, recent);

    if (price === null) {
      price = await getPriceFallback(id);
    }

    if (!grouped[category]) grouped[category] = [];

    grouped[category].push({
      name,
      price
    });
  }

  const result = {};

  for (const cat in grouped) {
    result[cat] = grouped[cat]
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);
  }

  return result;
}

// ---------------- ROUTE ----------------
app.get("/", async (req, res) => {
  const data = await buildDashboard();

  let html = `<h1>🔥 WARFRAME FARM DASHBOARD</h1>`;

  for (const cat in data) {
    html += `<h2>${cat}</h2>`;

    data[cat].forEach((item) => {
      html += `
        <div style="margin-bottom:10px">
          🔥 ${item.name}<br/>
          💰 ${item.price} Platinum
        </div>
      `;
    });
  }

  res.send(html);
});

// ---------------- STARTUP SEGURO (IMPORTANTE) ----------------
app.listen(PORT, "0.0.0.0", async () => {
  console.log("🚀 ONLINE PORT:", PORT);

  // 🔥 NÃO BLOQUEIA O SERVER
  updateItemsCache();
  updateRecentCache();

  // atualiza recent a cada 1h
  setInterval(updateRecentCache, 60 * 60 * 1000);
});