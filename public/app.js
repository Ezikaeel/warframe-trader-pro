const socket = io();

// -----------------------------
// STATUS DE CONEXÃO
// -----------------------------
const status = document.getElementById("status");

socket.on("connect", () => {
    status.innerText = "🟢 Conectado ao servidor";
    status.style.color = "#00ff99";
});

socket.on("disconnect", () => {
    status.innerText = "🔴 Desconectado";
    status.style.color = "#ff4d4d";
});

// -----------------------------
// FUNÇÃO PARA PREENCHER TABELAS
// -----------------------------
function fillTable(id, data) {
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = "";

    data.slice(0, 20).forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${item.name || item.slug || "unknown"}</td>
            <td>${item.price ?? 0}p</td>
        `;

        tbody.appendChild(row);
    });
}

// -----------------------------
// RECEBER DADOS DO SERVER
// -----------------------------
socket.on("update", (data) => {

    if (!data) return;

    if (data.global) fillTable("global", data.global);
    if (data.WARFRAME_PRIME_SET) fillTable("warframe", data.WARFRAME_PRIME_SET);
    if (data.WEAPON_PRIME_SET) fillTable("weapon", data.WEAPON_PRIME_SET);
    if (data.MODS) fillTable("mods", data.MODS);
    if (data.ARCANES) fillTable("arcanes", data.ARCANES);

});