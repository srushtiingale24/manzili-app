import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

const MOYASAR_CSS = "https://cdn.moyasar.com/mysr/1.14.0/moyasar.css";
const MOYASAR_JS = "https://cdn.moyasar.com/mysr/1.14.0/moyasar.js";

// Safe to expose in frontend code — this is the *publishable* key, not
// the secret one. Get it from https://dashboard.moyasar.com -> Developers.
const MOYASAR_PUBLISHABLE_KEY = "pk_test_YOUR_MOYASAR_PUBLISHABLE_KEY";

let moyasarPromise = null;
function loadMoyasar() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Moyasar) return Promise.resolve(window.Moyasar);
  if (moyasarPromise) return moyasarPromise;

  moyasarPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("moyasar-css")) {
      const link = document.createElement("link");
      link.id = "moyasar-css";
      link.rel = "stylesheet";
      link.href = MOYASAR_CSS;
      document.head.appendChild(link);
    }
    const existing = document.getElementById("moyasar-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Moyasar));
      existing.addEventListener("error", () => reject(new Error("Moyasar failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "moyasar-script";
    script.src = MOYASAR_JS;
    script.async = true;
    script.onload = () => resolve(window.Moyasar);
    script.onerror = () => reject(new Error("Moyasar failed to load"));
    document.head.appendChild(script);
  });
  return moyasarPromise;
}

/**
 * Renders Moyasar's hosted payment form covering Mada, credit/debit
 * cards, Apple Pay, and STC Pay in one widget. Card details are typed
 * directly into Moyasar's own secure iframe and never pass through our
 * frontend or backend code (so we never touch raw card numbers, and
 * there's no PCI-DSS burden on this app). The form talks to Moyasar's
 * API itself using the *publishable* key and hands back a payment id —
 * our backend then independently re-verifies that payment with the
 * *secret* key before an order is ever created (see /api/payments/verify).
 */
export default function PaymentForm({ amountSar, description, onPaid, onError }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMoyasar()
      .then((Moyasar) => {
        if (cancelled || !containerRef.current) return;
        Moyasar.init({
          element: containerRef.current,
          amount: Math.round(amountSar * 100), // Moyasar takes halalas, not SAR
          currency: "SAR",
          description,
          publishable_api_key: MOYASAR_PUBLISHABLE_KEY,
          methods: ["creditcard", "applepay", "stcpay"], // Mada cards are handled under "creditcard"
          callback_url: window.location.href, // needed for 3-D Secure redirects
          on_completed: (payment) => onPaid(payment),
          on_failure: (payment) => onError(payment?.source?.message || "Payment failed. Please try again."),
        });
        setReady(true);
      })
      .catch(() => setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountSar]);

  if (loadFailed) {
    return (
      <div className="flex items-center gap-2 text-sm p-4 rounded-xl" style={{ backgroundColor: "#F4EAD4", color: "#B3432E" }}>
        <AlertCircle size={16} />
        Couldn't load the payment form. Check your connection and try again.
      </div>
    );
  }

  return (
    <div>
      {!ready && (
        <div className="flex items-center gap-2 text-sm p-4" style={{ color: "#5B6B67" }}>
          <Loader2 size={16} className="animate-spin" />
          Loading secure payment form…
        </div>
      )}
      <div ref={containerRef} id="mysr-form" />
    </div>
  );
}
