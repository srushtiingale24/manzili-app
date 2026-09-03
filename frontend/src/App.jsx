import React, { useState } from "react";
import AuthScreen from "./AuthScreen";
import AdminDashboard from "./AdminDashboard";
import ServiceSelector from "./ServiceSelector";
import CleaningBooking from "./CleaningBooking";
import { loadSession, clearSession } from "./api";

// Visit /admin for the staff dashboard, anything else for the customer
// booking flow. No react-router dependency needed for just two routes.
const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [selectedService, setSelectedService] = useState(null);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setSelectedService(null);
  };

  if (isAdminRoute) {
    if (!session || session.user.role !== "admin") {
      return <AuthScreen variant="admin" onSuccess={(user) => setSession({ user })} />;
    }
    return <AdminDashboard onLogout={handleLogout} />;
  }

  if (!session) {
    return <AuthScreen variant="customer" onSuccess={(user) => setSession({ user })} />;
  }

  // Only "cleaning" is wired up today — the rest of the catalog is shown
  // but disabled in ServiceSelector, ready to plug in here later.
  if (!selectedService) {
    return <ServiceSelector user={session.user} onSelect={setSelectedService} onLogout={handleLogout} />;
  }

  if (selectedService === "cleaning") {
    return (
      <CleaningBooking
        user={session.user}
        onLogout={handleLogout}
        onBackToServices={() => setSelectedService(null)}
      />
    );
  }

  return null;
}
