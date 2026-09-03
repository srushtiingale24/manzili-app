import React, { useEffect, useState } from "react";
import { X, Clock, MapPin, Wallet, Loader2 } from "lucide-react";
import { apiRequest } from "./api";

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

const fontDisplay = { fontFamily: "'Cairo', sans-serif" };

export default function OrderHistory({ onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/orders/mine", { auth: true })
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load your orders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(20,35,31,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ backgroundColor: palette.surface }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${palette.line}` }}
        >
          <h2 className="font-extrabold text-lg" style={{ ...fontDisplay, color: palette.ink }}>
            Your Bookings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: palette.bg }}
            aria-label="Close"
          >
            <X size={16} style={{ color: palette.ink }} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: palette.inkMuted }}>
              <Loader2 size={18} className="animate-spin" />
              Loading your bookings…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-center py-10" style={{ color: "#B3432E" }}>
              {error}
            </p>
          )}

          {!loading && !error && orders.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: palette.inkMuted }}>
              You haven't booked anything yet — your bookings will show up here.
            </p>
          )}

          {!loading &&
            !error &&
            orders.map((o) => {
              const isCod = o.payment_method === "cod";
              const statusLabel =
                o.payment_status === "paid" ? "Paid" : isCod ? "Cash on Delivery" : o.payment_status;
              return (
                <div key={o.id} className="rounded-xl p-4" style={{ border: `1px solid ${palette.line}` }}>
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
                  <div className="space-y-1 text-xs" style={{ color: palette.inkMuted }}>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} /> {o.visit_date} · {o.time_slot}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} /> {o.building}, {o.district}, {o.city}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wallet size={13} /> {isCod ? "Cash on Delivery" : o.payment_method}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: `1px dashed ${palette.line}` }}>
                    <span className="text-xs" style={{ color: palette.inkMuted }}>
                      {o.hours}h × {o.cleaners} cleaner(s)
                    </span>
                    <span className="font-extrabold" style={{ ...fontDisplay, color: palette.primary }}>
                      {o.amount_sar} SAR
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
