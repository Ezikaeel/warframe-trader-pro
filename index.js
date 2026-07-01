const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();

// -----------------------------
// URLS
// -----------------------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_RECENT_URL = "https://api.warframe.market/v2/orders/recent";
const ORDERS_ITEM_URL = "https://api.warframe.market/v2/orders/itemId/";

// -----------------------------
// CACHE FILE
// -----------------------------
const CACHE_FILE = "./price-cache.json";

// -----------------------------
// SERVER
// -----------------------------
app.get("/", (req, res) => {
  res.send("🔥 Warframe Engine ONLINE - FARM DASHBOARD ativo");
});

// -----------------------------
// LOAD CACHE
// -----------------------------
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

// -----------------------------
// SAVE CACHE
// -----------------------------
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

let priceCache = loadCache();

// -----------------------------
// FETCH ITEMS
// -----------------------------
async function fetchItems() {
  const res = await axios.get(ITEMS_URL);
  return res.data.data || [];
}

// -----------------------------
// FETCH RECENT ORDERS
// -----------------------------
async function fetchOrders() {
  const res = await axios.get(ORDERS_RECENT_URL);
  return res.data.data || [];
}

// -----------------------------
// PRICE MAP (RECENT)
// -----------------------------
function buildPriceMap(orders) {
  const map = new Map();

  for (const o of orders) {
    const id = o.item_id || o.itemId || o.id;
    const price = o.platinum ?? o.price ?? null;

    if (!id || !price) continue;

    if (!map.has(id) || price < map.get(id)) {
      map.set(id, price);
    }
  }

  return map;
}

// -----------------------------
// TAGS
// -----------------------------
function getTags(item) {
  if (!item) return [];
  if (Array.isArray(item.tags)) return item.tags.map(t => t.toLowerCase());
  return [];
}

// -----------------------------
// CATEGORY ENGINE
// -----------------------------
function getCategory(item) {
  const tags = getTags(item);
  const has = (t) => tags.includes(t);

  if (has("arcane") || has("arcane_enhancement")) return "ARCANES";

  if (has("prime") && has("warframe")) {
    if (has("chassis") || has("neuroptics") || has("systems") || has("blueprint")) {
      return "WARFRAME_PRIME_PART";
    }
    return "WARFRAME_PRIME_SET";
  }

  if (has("prime") && has("weapon")) {
    if (has("set")) return "WEAPON_PRIME_SET";
    return "WEAPON_PRIME_PART";
  }

  if (has("mod") || has("archon") || has("riven") || has("galvanized") || has("primed")) {
    if (has("riven")) return "MOD_RIVEN";
    if (has("archon")) return "MOD_ARCHON";
    return "MODS";
  }

  return "OTHER";
}

// -----------------------------
// SMART PRICE SYSTEM
// -----------------------------
async function getPriceForItem(itemId, recentMap) {
  // 1. cache local
  if (priceCache[itemId]) {
    return priceCache[itemId];
  }

  // 2. recent API
  if (recentMap.has(itemId)) {
    priceCache[itemId] = recentMap.get(itemId);
    return recentMap.get(itemId);
  }

  // 3. fallback itemId
  try {
    const res = await axios.get(`${ORDERS_ITEM_URL}${itemId}`);

    const orders = res.data.data || [];

    let best = null;

    for (const o of orders) {
      const price = o.platinum ?? o.price ?? null;
      if (!price) continue;

      if (!best || price < best) {
        best = price;
      }
    }

    if (best) {
      priceCache[itemId] = best;
      saveCache(priceCache);
    }

    return best;
  } catch (err) {
    return null;
  }
}

// -----------------------------
// ENGINE CORE
// -----------------------------
async function runEngine() {
  console.log("🚀 ENGINE ONLINE (SMART + CACHE + ARCANE)");

  const items = await fetchItems();
  const orders = await fetchOrders();

  console.log("📦 items:", items.length);
  console.log("💰 orders:", orders.length);

  const recentMap = buildPriceMap(orders);

  const grouped = {
    WARFRAME_PRIME_SET: [],
    WARFRAME_PRIME_PART: [],
    WEAPON_PRIME_SET: [],
    WEAPON_PRIME_PART: [],
    MODS: [],
    MOD_RIVEN: [],
    MOD_ARCHON: [],
    ARCANES: [],
    OTHER: [],
  };

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = getCategory(item);
    const price = await getPriceForItem(id, recentMap);

    grouped[category].push({
      name: item.slug || item.name || id,
      price: price || 0,
    });
  }

  console.log("\n🔥 WARFRAME FARM DASHBOARD\n");

  for (const [cat, list] of Object.entries(grouped)) {
    console.log(`=== ${cat} ===`);

    const top = list
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);

    if (!top.length) {
      console.log("vazio\n");
      continue;
    }

    for (const item of top) {
      console.log(`
🔥 ${item.name}
💰 ${item.price} Platinum
⏱ Farm: 15–20 min
📍 Relíquias: Neo / Axi
🎯 Missões: Ukko / Apollo / Hepit
★★★★★ Alta demanda
      `);
    }
  }

  const all = Object.values(grouped).flat();

  const topGlobal = all
    .sort((a, b) => b.price - a.price)
    .slice(0,