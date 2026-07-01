const express = require("express");
const axios = require("axios");

const app = express();

// -----------------------------
// FRONTEND
// -----------------------------
app.use(express.static("public"));

// -----------------------------
// API URLS
// -----------------------------
const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/recent";

// -----------------------------
// CACHE
// -----------------------------
let items = [];
let orders = [];
let priceMap = new Map();

// -----------------------------
// FETCH ITEMS
// -----------------------------
async function fetchItems() {
  const res = await axios.get(ITEMS_URL);
  return res.data.data || res.data || [];
}

// -----------------------------
// FETCH ORDERS
// -----------------------------
async function fetchOrders() {
  const res = await axios.get(ORDERS_URL);
  return res.data.data || res.data || [];
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

  if (has("prime") && has("warframe")) {
    if (has("chassis") || has("neuroptics") || has("systems") || has("blueprint"))
      return "WARFRAME_PRIME_PART";

    if (has("set")) return "WARFRAME_PRIME_SET";
  }

  if (has("prime") && has("weapon")) {
    if (has("set")) return "WEAPON_PRIME_SET";
    return "WEAPON_PRIME_PART";
  }

  if (has("mod") || has("archon") || has("riven")) {
    if (has("riven")) return "MOD_RIVEN";
    if (has("archon")) return "MOD_ARCHON";
    return "MODS";
  }

  if (has("arcane") || has("arcane_enhancement")) {
    return "ARCANES";
  }

  return "OTHER";
}

// -----------------------------
// ENGINE RUN
// -----------------------------
async function buildData() {
  items = await fetchItems();
  orders = await fetchOrders();

  priceMap = buildPriceMap(orders);

  const grouped = {
    WARFRAME_PRIME_SET: [],
    WARFRAME_PRIME_PART: [],
    WEAPON_PRIME_SET: [],
    WEAPON_PRIME_PART: [],
    MODS: [],
    MOD_ARCHON: [],
    MOD_RIVEN: [],
    ARCANES: [],
    OTHER: [],
  };

  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = getCategory(item);
    const price = priceMap.get(id) || 0;

    grouped[category].push({
      name: item.slug.replace(/_/g, " "),
      price,
      category,
    });
  }

  return grouped;
}

// -----------------------------
// API
// -----------------------------
app.get("/data", async (req, res) => {
  try {
    const data = await buildData();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

// -----------------------------
// HOME
// -----------------------------
app.get("/", (req, res) => {
  res.send("Warframe Engine ONLINE 🚀");
});

// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});