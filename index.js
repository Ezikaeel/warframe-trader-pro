const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ================= CACHE =================
const CACHE_ITEMS = "./cache_items.json";
const CACHE_RECENT = "./cache_recent.json";

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

// ================= CACHE UPDATE =================
async function updateItems() {
  try {
    const res = await axios.get(ITEMS_URL, { timeout: 20000 });
    write(CACHE_ITEMS, res.data.data || []);
    console.log("📦 ITEMS OK");
  } catch (e) {
    console.log("items error:", e.message);
  }
}

async function updateRecent() {
  try {
    const res = await axios.get(RECENT_URL, { timeout: 20000 });
    write(CACHE_RECENT, res.data.data || []);
    console.log("💰 RECENT OK");
  } catch (e) {
    console.log("recent error:", e.message);
  }
}

// ================= PRICE =================
function getRecentPrice(id, recent) {
  const order = (recent || []).find(o => o.item_id === id);
  return order ? order.platinum : null;
}

// fallback seguro
async function getFallbackPrice(id) {
  try {
    const res = await axios.get(
      `https://api.warframe.market/v2/orders/itemId/${id}`,
      { timeout: 20000 }
    );

    const orders = res.data.data || [];

    let min = null;

    for (const o of orders) {
      const price = o.platinum || 0;
      if (min === null || price < min) {
        min = price;
      }
    }

    return min || 0;
  } catch {
    return 0;
  }
}

// ================= CATEGORY FIX (REAL) =================
function getCategory(item) {
  const name = (item.slug || "").toLowerCase();

  if (name.includes("prime")) return "PRIME SET";
  if (name.includes("necramech")) return "NECRAMECH";
  if (name.includes("arcane")) return "ARCANE";
  if (name.includes("weapon")) return "WEAPON";

  return "OTHER";
}

// ================= NAME FIX =================
function getName(item) {
  return (
    item.name ||
    item.slug ||
    "unknown_item"
  );
}

// ================= ENGINE =================
async function buildDashboard() {
  const items = read(CACHE_ITEMS) || [];
  const recent = read(CACHE_RECENT) || [];

  if (!items.length) {
    return {
      SYSTEM: [{ name: "Cache carregando...", price: 0 }]
    };
  }

  const grouped = {};

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = getCategory(item);
    const name = getName(item);

    let price = getRecentPrice(id, recent);

    // fallback SOMENTE se necessário
    if (price === null || price === undefined) {
      price = await getFallbackPrice(id);
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

// ================= ROUTE =================
app.get("/", async (req, res) => {
  const data = await buildDashboard();

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

// ================= START =================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER RUNNING:", PORT);

  setTimeout(async () => {
    await updateItems();
    await updateRecent();
  }, 1000);

  setInterval(updateRecent, 60 * 60 * 1000);
});