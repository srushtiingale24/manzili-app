import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.js";
import ordersRoutes from "./routes/orders.js";
import usersRoutes from "./routes/users.js";
import paymentsRouterFactory from "./routes/payments.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*" },
});

// Makes `io` reachable from any route via req.app.get("io") without
// needing to turn every router into a factory (only payments.js needs
// that, since it emits from a nested async block).
app.set("io", io);

// Admin dashboards authenticate over the socket handshake and join a
// private "admins" room, so only staff ever receive live order pushes.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});
io.on("connection", (socket) => {
  if (socket.user?.role === "admin") socket.join("admins");
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/admin/users", usersRoutes);
app.use("/api/payments", paymentsRouterFactory(io));

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Manzili backend running on http://localhost:${PORT}`);
});
