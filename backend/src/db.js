import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "data.db"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    hours INTEGER NOT NULL,
    cleaners INTEGER NOT NULL,
    addons_json TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    building TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    amount_sar INTEGER NOT NULL,
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
    moyasar_payment_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed a default admin account the first time the server ever runs,
// so there's always a way in. Change this password immediately.
const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@manzili.sa";
const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!adminExists) {
  const passwordHash = bcrypt.hashSync(process.env.ADMIN_DEFAULT_PASSWORD || "Admin@12345", 10);
  db.prepare(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
  ).run("Admin", adminEmail, "", passwordHash);
  console.log(`Seeded default admin account -> ${adminEmail}`);
}

// Two demo customer accounts so there's something to log in and test
// with immediately, without needing to register first.
const demoAccounts = [
  { name: "Demo Customer One", email: "demo1@manzili.sa", phone: "0501111111", password: "Demo@1234" },
  { name: "Demo Customer Two", email: "demo2@manzili.sa", phone: "0502222222", password: "Demo@1234" },
];
for (const acc of demoAccounts) {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(acc.email);
  if (!exists) {
    const passwordHash = bcrypt.hashSync(acc.password, 10);
    db.prepare(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')"
    ).run(acc.name, acc.email, acc.phone, passwordHash);
    console.log(`Seeded demo customer -> ${acc.email}`);
  }
}

export default db;
