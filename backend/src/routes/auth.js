import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";

const router = Router();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Customer sign-up. Admin accounts are never created through this route —
// they're seeded server-side (see db.js) or created directly in the DB.
router.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')")
    .run(name, email, phone || "", passwordHash);

  const user = { id: result.lastInsertRowid, name, email, role: "customer" };

  // Let any connected admin dashboard know a new account just showed up,
  // so the Accounts tab updates without needing a refresh.
  const io = req.app.get("io");
  if (io) {
    io.to("admins").emit("new_user", {
      id: user.id,
      name,
      email,
      phone: phone || "",
      role: "customer",
      created_at: new Date().toISOString(),
    });
  }

  res.json({ token: issueToken(user), user });
});

// One login endpoint for everyone — the account's stored role decides
// whether it's a customer or an admin session. The admin login screen
// on the frontend simply rejects a token whose role isn't "admin".
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: issueToken(safeUser), user: safeUser });
});

export default router;
