import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ShieldCheck,
  LogOut,
  Clock,
  MapPin,
  Wallet,
  RefreshCcw,
  Users,
  ClipboardList,
  Mail,
  Phone,
} from "lucide-react";
import { apiRequest, loadSession, clearSession, API_BASE } from "./api";

const palette = {
  bg: "#F4F6F5",
  surface: "#FFFFFF",
  ink: "#14231F",
  inkMuted: "#5B6B67",
  primary: "#0E5C56",
  primaryTint: "#E3EEEC",
  accent: "#B8862B",
  accentTint: "#F4EAD4",
  sand: "#E7DCC3",
  line: "#E3E7E4",
  success: "#1F8A5F",
};

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState("orders"); // "orders" | "accounts"
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/orders", { auth: true });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/users", { auth: true });
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadUsers();
    const session = loadSession();
    if (!session) return;

    const socket = io(API_BASE, { auth: { token: session.token } });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    // Fires the instant a customer's payment/COD order is verified server-side.
    socket.on("new_order", (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    });
    // Fires the instant someone registers a new customer account.
    socket.on("new_user", (user) => {
      setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);
    });
    return () => socket.disconnect();
  }, []);

  const logout = () => {
    clearSession();
    onLogout();
  };

  const refresh = () => (tab === "orders" ? loadOrders() : loadUsers());

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: palette.surface, borderBottom: `1px solid ${palette.line}` }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} style={{ color: palette.ink }} />
          <h1 className="font-extrabold text-lg" style={{ fontFamily: "'Cairo', sans-serif", color: palette.ink }}>
            Manzili
          </h1>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-2"
            style={{
              backgroundColor: connected ? palette.primaryTint : palette.sand,
              color: connected ? palette.primary : palette.inkMuted,
            }}
          >
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={refresh} className="flex items-center gap-1 text-xs font-semibold" style={{ color: palette.primary }}>
            <RefreshCcw size={14} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-1 text-xs font-semibold" style={{ color: palette.inkMuted }}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-5">
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => setTab("orders")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition"
            style={{
              backgroundColor: tab === "orders" ? palette.primary : palette.surface,
              color: tab === "orders" ? "#fff" : palette.ink,
              border: `1px solid ${tab === "orders" ? palette.primary : palette.line}`,
            }}
          >
            <ClipboardList size={15} />
            Orders
            <span
              className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: tab === "orders" ? "rgba(255,255,255,0.2)" : palette.sand,
                color: tab === "orders" ? "#fff" : palette.inkMuted,
              }}
            >
              {orders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("accounts")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition"
            style={{
              backgroundColor: tab === "accounts" ? palette.primary : palette.surface,
              color: tab === "accounts" ? "#fff" : palette.ink,
              border: `1px solid ${tab === "accounts" ? palette.primary : palette.line}`,
            }}
          >
            <Users size={15} />
            Accounts
            <span
              className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: tab === "accounts" ? "rgba(255,255,255,0.2)" : palette.sand,
                color: tab === "accounts" ? "#fff" : palette.inkMuted,
              }}
            >
              {users.length}
            </span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-3">
        {loading && (
          <p className="text-sm text-center py-10" style={{ color: palette.inkMuted }}>
            Loading…
          </p>
        )}

        {!loading && tab === "orders" && orders.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: palette.inkMuted }}>
            No orders yet — new bookings (paid or Cash on Delivery) will appear here instantly.
          </p>
        )}

        {!loading &&
          tab === "orders" &&
          orders.map((o) => {
            const isCod = o.payment_method === "cod";
            const statusLabel =
              o.payment_status === "paid" ? "PAID" : isCod ? "CASH ON DELIVERY" : o.payment_status.toUpperCase();
            const methodLabel = isCod ? "Cash on Delivery" : o.payment_method;
            return (
              <div key={o.id} className="rounded-xl p-4" style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm" style={{ color: palette.ink }}>
                    {o.booking_ref}
                  </span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: o.payment_status === "paid" ? "#E3F4EC" : palette.accentTint,
                      color: o.payment_status === "paid" ? palette.success : palette.accent,
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs" style={{ color: palette.inkMuted }}>
                  <div className="flex items-center gap-1">
                    <Clock size={13} /> {o.visit_date} · {o.time_slot}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={13} /> {o.city}, {o.district}
                  </div>
                  <div className="flex items-center gap-1">
                    <Wallet size={13} /> {methodLabel}
                  </div>
                  <div className="font-bold" style={{ color: palette.ink }}>
                    {o.amount_sar} SAR
                  </div>
                </div>
              </div>
            );
          })}

        {!loading && tab === "accounts" && users.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: palette.inkMuted }}>
            No accounts yet.
          </p>
        )}

        {!loading &&
          tab === "accounts" &&
          users.map((u) => (
            <div key={u.id} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: palette.ink }}>
                    {u.name}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{
                      backgroundColor: u.role === "admin" ? palette.ink : palette.primaryTint,
                      color: u.role === "admin" ? "#fff" : palette.primary,
                    }}
                  >
                    {u.role}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: palette.inkMuted }}>
                  <span className="flex items-center gap-1">
                    <Mail size={12} /> {u.email}
                  </span>
                  {u.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {u.phone}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] shrink-0" style={{ color: palette.inkMuted }}>
                Joined {new Date(u.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
