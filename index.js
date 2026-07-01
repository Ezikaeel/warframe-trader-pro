const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();

// 🔥 GARANTE PORTA VÁLIDA SEMPRE
const PORT = Number(process.env.PORT || 3000);

// ---------------- CACHE ----------------
const CACHE_ITEMS = "./cache_items.json";
const CACHE_RECENT = "./cache_recent.json";

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
    console.log("cache save error:", e.message);
  }
}

// ---------------- API ----------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const RECENT_URL = "https://api.warframe.market/v2/orders/recent";

// ---------------- SAFE CACHE LOAD (NÃO BLOQUEIA SERVER) ----------------
async function updateItemsCache() {
  try {
    const res = await axios.get(ITEMS_URL, {
      timeout: 15000
    });

    saveCache(CACHE_ITEMS, res.data.data || []);
    console.log("📦 CACHE ITEMS UPDATED");
  } catch (e) {
    console.log("items cache error:", e.message);
  }
}

async function updateRecentCache() {
  try {
    const res = await axios.get(RECENT_URL, {
      timeout: 15000
    });

    saveCache(CACHE_RECENT, res.data.data || []);
    console.log("💰 CACHE RECENT UPDATED");
  } catch (e) {
    console.log("recent cache error:", e.message);
  }
}

// ---------------- ROUTE SIMPLES (TESTE PORTA PRIMEIRO) ----------------
app.get("/", (req, res) => {
  res.send("🔥 WARFRAME ENGINE ONLINE");
});

// ---------------- START SERVER PRIMEIRO (CRÍTICO) ----------------
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON PORT:", PORT);

  // 🔥 RODA CACHE DEPOIS QUE PORTA JÁ ESTÁ ABERTA
  setTimeout(() => {
    updateItemsCache();
    updateRecentCache();
  }, 1000);

  // atualização leve
  setInterval(updateRecentCache, 60 * 60 * 1000);
});