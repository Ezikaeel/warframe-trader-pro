const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();

// ================= PORT RENDER =================
const PORT = Number(process.env.PORT || 3000);

// ================= CACHE FILES =================
const CACHE_ITEMS = "./cache_items.json";
const CACHE_RECENT = "./cache_recent.json";

// ================= HELPERS =================
function loadCache(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function saveCache(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("cache error:", e.message);
  }
}

// ================= API =================
const ITEMS_URL = "https://api.warframe.market/v2/items";
const RECENT_URL = "https://api.warframe.market/v2/orders/recent";

// ================= UPDATE CACHE =================
async function updateItemsCache() {
  try {
    const res = await axios.get(ITEMS_URL, { timeout: 15000 });
    saveCache(CACHE_ITEMS, res.data.data || []);
    console.log("📦 CACHE ITEMS UPDATED");
  } catch (e) {
    console.log("items error:", e.message);
  }
}

async function updateRecentCache() {
  try {
    const res = await axios.get(RECENT_URL, { timeout: 15000 });
    saveCache(CACHE_RECENT, res.data.data || []);
    console.log("💰 CACHE RECENT UPDATED");
  } catch (e) {
    console.log("recent error:", e.message);
  }
}

// ================= PRICE LOGIC =================
function getPriceFromRecent(id, recent) {
  for (const o of recent || []) {
    if (o.item_id === id) {
      return o.platinum || null;
    }
  }
  return null;
}

async function getPriceFallback(id) {
  try {
    const res = await axios.get(
      `https://api.warframe.market/v2/orders/itemId/${id}`,
      { timeout: 15000 }
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

// ================= ENGINE =================
async function buildDashboard() {
  const items = loadCache(CACHE_ITEMS) || [];
  const recent = loadCache(CACHE_RECENT) || [];

  if (!items.length) {
    return {
      SYSTEM: [{ name: "Carregando cache...", price: 0 }]
    };
  }

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

// ================= SINGLE ROUTE (IMPORTANTE) =================
app.get("/", async (req, res) => {
  try {
    const data = await buildDashboard();

    let html = `
    <html>
    <head>
      <title>Warframe Farm Dashboard</title>
      <style>
        body { font-family: Arial; background:#111; color:#fff; padding:20px; }
        h1 { color:#00ff99; }
        h2 { color:#ffcc00; margin-top:30px; }
        .item { background:#222; padding:10px; margin:8px 0; border-radius:8px; }
      </style>
    </head>
    <body>
      <h1>🔥 WARFRAME FARM DASHBOARD</h1>
    `;

    for (const cat in data) {
      html += `<h2>${cat}</h2>`;

      data[cat].forEach((item) => {
        html += `
          <div class="item">
            🔥 <b>${item.name}</b><br/>
            💰 ${item.price} Platinum
          </div>
        `;
      });
    }

    html += `</body></html>`;

    res.send(html);
  } catch (e) {
    res.send(`<h1>Erro</h1><pre>${e.message}</pre>`);
  }
});

// ================= START SERVER =================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER RUNNING ON PORT:", PORT);

  // NÃO bloqueia Render
  setTimeout(() => {
    updateItemsCache();
    updateRecentCache();
  }, 1000);

  setInterval(updateRecentCache, 60 * 60 * 1000);
});