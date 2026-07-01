const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ================= CACHE =================
const CACHE_ITEMS = "./cache_items.json";
const CACHE_RECENT = "./cache_recent.json";
const CACHE_PRICES = "./cache_prices.json";

// ================= HELPERS =================
function read(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= API =================
const ITEMS_URL = "https://api.warframe.market/v2/items";
const RECENT_URL = "https://api.warframe.market/v2/orders/recent";

// ================= UPDATE ITEMS (1x dia) =================
async function updateItems() {
  try {
    const res = await axios.get(ITEMS_URL, { timeout: 20000 });
    write(CACHE_ITEMS, res.data.data || []);
    console.log("📦 ITEMS CACHE OK");
  } catch (e) {
    console.log("items error:", e.message);
  }
}

// ================= UPDATE RECENT (1h) =================
async function updateRecent() {
  try {
    const res = await axios.get(RECENT_URL, { timeout: 20000 });
    write(CACHE_RECENT, res.data.data || []);
    console.log("💰 RECENT CACHE OK");
  } catch (e) {
    console.log("recent error:", e.message);
  }
}

// ================= PREBUILD PRICES (CRÍTICO) =================
function buildPrices() {
  const items = read(CACHE_ITEMS) || [];
  const recent = read(CACHE_RECENT) || [];

  const prices = {};

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const order = recent.find(o => o.item_id === id);

    prices[id] = order?.platinum || 0;
  }

  write(CACHE_PRICES, prices);
  console.log("⚡ PRICES CACHE BUILT");
}

// ================= ENGINE (FAST ONLY) =================
function buildDashboard() {
  const items = read(CACHE_ITEMS) || [];
  const prices = read(CACHE_PRICES) || {};

  const grouped = {};

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = (item.tags || []).includes("prime")
      ? "PRIME"
      : "OTHER";

    if (!grouped[category]) grouped[category] = [];

    grouped[category].push({
      name: item.slug,
      price: prices[id] || 0
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

// ================= ROUTE ULTRA RÁPIDA =================
app.get("/", (req, res) => {
  const data = buildDashboard();

  let html = `
  <html>
  <head>
    <title>Warframe Farm Dashboard</title>
    <style>
      body { font-family: Arial; background:#111; color:#fff; padding:20px; }
      h1 { color:#00ff99; }
      h2 { color:#ffcc00; margin-top:25px; }
      .item { background:#222; padding:10px; margin:8px 0; border-radius:8px; }
    </style>
  </head>
  <body>
    <h1>🔥 WARFRAME FARM DASHBOARD</h1>
  `;

  for (const cat in data) {
    html += `<h2>${cat}</h2>`;

    data[cat].forEach(i => {
      html += `
        <div class="item">
          🔥 ${i.name}<br/>
          💰 ${i.price} Platinum
        </div>
      `;
    });
  }

  html += "</body></html>";

  res.send(html);
});

// ================= STARTUP (NÃO BLOQUEIA) =================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER RUNNING:", PORT);

  // 🔥 roda tudo em background
  setTimeout(async () => {
    await updateItems();
    await updateRecent();
    buildPrices();
  }, 1000);

  // refresh leve
  setInterval(async () => {
    await updateRecent();
    buildPrices();
  }, 60 * 60 * 1000);
});