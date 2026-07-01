const axios = require("axios");
const { Server } = require("socket.io");

const ITEMS_URL = "https://api.warframe.market/v2/items";
const ORDERS_URL = "https://api.warframe.market/v2/orders/recent";

// -----------------------------
// CACHE
// -----------------------------
let items = [];
let orders = [];
let priceMap = new Map();

// socket global (será injetado pelo server)
let io;

// -----------------------------
// UTIL: formatar nome bonito
// -----------------------------
function formatName(slug = "") {
    return slug
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

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
    if (Array.isArray(item.tags)) {
        return item.tags.map(t => t.toLowerCase());
    }
    return [];
}

// -----------------------------
// CATEGORY ENGINE
// -----------------------------
function getCategory(item) {
    const tags = getTags(item);
    const has = (t) => tags.includes(t);

    // PRIME WARFRAME
    if (has("prime") && has("warframe")) {
        if (has("chassis") || has("systems") || has("neuroptics") || has("blueprint"))
            return "WARFRAME_PRIME_PART";

        if (has("set")) return "WARFRAME_PRIME_SET";
    }

    // PRIME WEAPON
    if (has("prime") && has("weapon")) {
        if (has("set")) return "WEAPON_PRIME_SET";
        return "WEAPON_PRIME_PART";
    }

    // MODS (filtrando primed/galvanized daqui embaixo)
    if (has("mod") || has("archon") || has("riven") || has("primed") || has("galvanized")) {

        if (has("riven")) return "MOD_RIVEN";
        if (has("archon")) return "MOD_ARCHON";

        if (has("primed")) return "MODS";
        if (has("galvanized")) return "MODS";

        return "MODS";
    }

    // ARCANE
    if (has("arcane_enhancement") || has("arcane")) {
        return "ARCANES";
    }

    return "OTHER";
}

// -----------------------------
// ENGINE CORE
// -----------------------------
async function runEngine() {

    items = await fetchItems();
    orders = await fetchOrders();

    priceMap = buildPriceMap(orders);

    const grouped = {
        WARFRAME_PRIME_SET: [],
        WARFRAME_PRIME_PART: [],
        WEAPON_PRIME_SET: [],
        WEAPON_PRIME_PART: [],
        MOD_RIVEN: [],
        MOD_ARCHON: [],
        MODS: [],
        ARCANES: [],
        OTHER: []
    };

    for (const item of items) {

        const id = item.id;
        if (!id) continue;

        const category = getCategory(item);
        const price = priceMap.get(id) || 0;

        const entry = {
            name: formatName(item.slug || item.name || "unknown"),
            price
        };

        grouped[category].push(entry);
    }

    // ordenar
    for (const key in grouped) {
        grouped[key] = grouped[key]
            .sort((a, b) => b.price - a.price)
            .slice(0, 20);
    }

    // TOP GLOBAL
    const global = Object.values(grouped)
        .flat()
        .sort((a, b) => b.price - a.price)
        .slice(0, 20);

    const payload = {
        global,
        ...grouped
    };

    // enviar pro front
    if (io) {
        io.emit("update", payload);
    }

    console.log("🔄 atualização enviada:", new Date().toLocaleTimeString());
}

// -----------------------------
// LOOP AUTOMÁTICO
// -----------------------------
function startAutoEngine(socketServer) {

    io = socketServer;

    console.log("🚀 ENGINE ONLINE MODE");

    runEngine();

    setInterval(() => {
        runEngine();
    }, 60 * 1000); // 1 minuto
}

module.exports = { startAutoEngine };