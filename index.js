// 🚀 WARFRAME ENGINE vNEXT (SMART PRICE FALLBACK + ARCANE + CLEAN VIEW)

const axios = require("axios");

const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_RECENT_URL = "https://api.warframe.market/v2/orders/recent";
const ORDERS_ITEM_URL = "https://api.warframe.market/v2/orders/itemId/";

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
// FETCH RECENT ORDERS
// -----------------------------
async function fetchOrders() {
  const res = await axios.get(ORDERS_RECENT_URL);
  return res.data.data || res.data || [];
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

  // WARFRAME PRIME
  if (has("prime") && has("warframe")) {
    if (has("chassis") || has("neuroptics") || has("systems") || has("blueprint")) {
      return "WARFRAME_PRIME_PART";
    }
    if (has("set")) return "WARFRAME_PRIME_SET";
  }

  // WEAPONS PRIME
  if (has("prime") && has("weapon")) {
    if (has("set")) return "WEAPON_PRIME_SET";
    return "WEAPON_PRIME_PART";
  }

  // MODS
  if (
    has("mod") ||
    has("archon") ||
    has("riven") ||
    has("galvanized") ||
    has("primed")
  ) {
    if (has("riven")) return "MOD_RIVEN";
    if (has("archon")) return "MOD_ARCHON";
    return "MODS";
  }

  // ARCANE
  if (has("arcane") || has("arcane_enhancement")) {
    return "ARCANES";
  }

  return "OTHER";
}

// -----------------------------
// SMART PRICE (RECENT + FALLBACK)
// -----------------------------
async function getPriceForItem(itemId, recentMap) {
  // 1. RECENT FIRST
  if (recentMap.has(itemId)) {
    return recentMap.get(itemId);
  }

  // 2. FALLBACK ITEM ID
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

    return best;
  } catch (err) {
    return null;
  }
}

// -----------------------------
// ENGINE
// -----------------------------
async function run() {
  console.log("🚀 ENGINE SMART PRICE + ARCANE + CLEAN VIEW");

  items = await fetchItems();
  orders = await fetchOrders();

  console.log("📦 items:", items.length);
  console.log("💰 recent orders:", orders.length);

  priceMap = buildPriceMap(orders);

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

  // -----------------------------
  // PROCESS ITEMS
  // -----------------------------
  for (const item of items) {
    const id = item.id;
    if (!id) continue;

    const category = getCategory(item);

    const price = await getPriceForItem(id, priceMap);

    const entry = {
      name: item.slug || item.name || id,
      category,
      price,
    };

    grouped[category].push(entry);
  }

  console.log("\n🔥 WARFRAME FARM DASHBOARD\n");

  // -----------------------------
  // PRINT CLEAN VIEW
  // -----------------------------
  for (const [cat, list] of Object.entries(grouped)) {
    console.log(`=== ${cat} ===`);

    const top = list
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .slice(0, 20);

    if (!top.length) {
      console.log("vazio\n");
      continue;
    }

    for (const item of top) {
      console.log(`
🔥 ${item.name}
💰 ${item.price ?? "Sem dados"} Platinum
⏱ Farm: 15–20 min
📍 Relíquias: Neo / Axi (auto)
🎯 Missões: Ukko / Apollo / Hepit
★★★★★ Alta demanda
      `);
    }
  }

  // -----------------------------
  // TOP GLOBAL
  // -----------------------------
  const all = Object.values(grouped).flat();

  const topGlobal = all
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 20);

  console.log("\n🏆 TOP GLOBAL\n");

  for (const item of topGlobal) {
    console.log(`${item.name} → ${item.price ?? "Sem dados"}p`);
  }
}

// -----------------------------
run().catch(err => {
  console.error("❌ ERROR:", err);
});