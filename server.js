const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const { startAutoEngine } = require("./index");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// -----------------------------
// FRONTEND
// -----------------------------
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------
// SOCKET CONNECTION
// -----------------------------
io.on("connection", (socket) => {
    console.log("🟢 Cliente conectado:", socket.id);

    socket.on("disconnect", () => {
        console.log("🔴 Cliente desconectado:", socket.id);
    });
});

// -----------------------------
// START ENGINE
// -----------------------------
startAutoEngine(io);

// -----------------------------
// START SERVER
// -----------------------------
const PORT = 3000;

server.listen(PORT, () => {
    console.log(`🌐 SERVER ONLINE: http://localhost:${PORT}`);
});