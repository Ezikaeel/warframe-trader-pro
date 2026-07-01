// 🚀 WARFRAME MARKET ENGINE + SERVER ONLINE

const express = require("express");
const axios = require("axios");

const app = express();

// -----------------------------
// CONFIG
// -----------------------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/recent";

let cache = {
  items: [],
  orders: [],
  grouped: {},
  lastUpdate: null,
};

// -----------------------------
// ENGINE LOGIC
// -----------------------------
function getTags(item) {
  if (!item) return [];
  if (Array.isArray(item.tags)) return item.tags.map(t => t.toLowerCase());
  return [];
}

function getCategory(item) {
  const tags = getTags(item);
  const has = (t) => tags.includes(t);

  if (has("prime") && has("warframe")) {
    if (has("set")) return "WARFRAME_PRIME_SET";
    return "WARFRAME_PRIME_PART";
  }

  if (has("prime") && has("weapon")) {
    if (has("set")) return "WEAPON_PRIME_SET";
    return "WEAPON_PRIME_PART";
  }

  if (
    has("mod") ||
    has("archon") ||
    has("riven") ||
    has("galvanized") ||
    has("primed") ||
    has("arcane_enhancement")
  ) {
    if (has("riven")) return "MOD_RIVEN";
    if (has("archon")) return "MOD_ARCHON";
    if (has("arcane_enhancement")) return "ARCANE";
    return "MODS";
  }

  return "OTHER";
}

// -----------------------------
// FETCH DATA
// -----------------------------
async function fetchData() {
  const [itemsRes, ordersRes] = await Promise.all([
    axios.get(ITEMS_URL),
    axios.get(ORDERS_URL),
  ]);

  const items = itemsRes.data.data || [];
  const orders = ordersRes.data.data || [];

  return { items, orders };
}

// -----------------------------
// PRICE MAP
// -----------------------------
function buildPriceMap(orders) {
  const map = new Map();

  for (const o of orders) {
    const id = o.item_id || o.itemId || o.id;
    const price = o.platinum ?? o.price ?? 0;

    if (!id) continue;

    if (!map.has(id) || price < map.get(id)) {
      map.set(id, price);
    }
  }

  return map;
}

// -----------------------------
// UPDATE ENGINE
// -----------------------------
async function updateEngine() {
  try {
    const { items, orders } = await fetchData();
    const priceMap = buildPriceMap(orders);

    const grouped = {
      WARFRAME_PRIME_SET: [],
      WARFRAME_PRIME_PART: [],
      WEAPON_PRIME_SET: [],
      WEAPON_PRIME_PART: [],
      MOD_RIVEN: [],
      MOD_ARCHON: [],
      MODS: [],
      ARCANE: [],
      OTHER: [],
    };

    for (const item of items) {
      const id = item.id;
      if (!id) continue;

      const category = getCategory(item);
      const price = priceMap.get(id) || 0;

      grouped[category].push({
        name: item.slug, // 👈 nome ao invés de ID
        category,
        price,
      });
    }

    cache.items = items.length;
    cache.orders = orders.length;
    cache.grouped = grouped;
    cache.lastUpdate = new Date().toISOString();

    console.log("🔄 Engine atualizado:", cache.lastUpdate);
  } catch (err) {
    console.error("❌ Erro engine:", err.message);
  }
}

// -----------------------------
// AUTO REFRESH (IMPORTANTE PRA 24H)
// -----------------------------
setInterval(updateEngine, 60 * 1000); // 1 min

// -----------------------------
// ROUTES
// -----------------------------
app.get("/", (req, res) => {
  res.send("Warframe Engine ONLINE 🚀");
});

app.get("/api/data", (req, res) => {
  res.json(cache);
});

app.get("/api/top/:category", (req, res) => {
  const cat = req.params.category.toUpperCase();

  const list = cache.grouped[cat] || [];

  const top = list
    .sort((a, b) => b.price - a.price)
    .slice(0, 20);

  res.json(top);
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Servidor rodando na porta", PORT);

  await updateEngine(); // inicializa na hora
});