import React, { useState } from "react";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
const HOTEL_EMOJI = String.fromCodePoint(0x1f3e8);

export default function ReceptionPanel() {
  const [code, setCode] = useState("");
  const [action, setAction] = useState("checkin");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_code: code.trim().toUpperCase() })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error inesperado");
      } else {
        setResult(data);
        setCode("");
      }
    } catch (err) {
      console.error('ReceptionPanel error', err);
      setError("Error de conexión con el backend");
    }
    setLoading(false);
  };

  return (
    <div style={{
      width: "100%",
      background: "#fff",
      borderRadius: 20,
      padding: 24,
      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
      border: "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>Panel de Recepción</h2>
        <span style={{ fontSize: 24 }}>{HOTEL_EMOJI}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
        Gestioná los check-in y check-out ingresando el código de confirmación de la reserva.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="confirmation" style={{ fontSize: 14, fontWeight: 500 }}>Código de confirmación</label>
        <input
          id="confirmation"
            type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid #cbd5f5",
            background: "#f8fafc",
            color: "#111827",
            fontSize: 14
          }}
          placeholder="Ej: ABC12345"
          required
        />
        <div style={{ display: "flex", gap: 12, fontSize: 14, color: "#475569" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="radio" name="action" value="checkin" checked={action === "checkin"} onChange={() => setAction("checkin")} />
            Check-in
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="radio" name="action" value="checkout" checked={action === "checkout"} onChange={() => setAction("checkout")} />
            Check-out
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: action === "checkin" ? "#2563EB" : "#0EA5E9",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "12px 20px",
            fontWeight: 600,
            fontSize: 15,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 10px 30px rgba(37, 99, 235, 0.25)",
            transition: "filter 0.2s"
          }}
          onMouseEnter={(event) => (event.currentTarget.style.filter = "brightness(0.95)")}
          onMouseLeave={(event) => (event.currentTarget.style.filter = "brightness(1)")}
        >
          {loading ? "Procesando..." : action === "checkin" ? "Registrar Check-in" : "Registrar Check-out"}
        </button>
      </form>
      {error && <div style={{ color: "#DC2626", fontWeight: 500 }}>{error}</div>}
      {result && (
        <div style={{ background: "#f1f5f9", padding: 16, borderRadius: 12, fontSize: 14, color: "#1f2937" }}>
          <b>{action === "checkin" ? "Check-in realizado" : "Check-out realizado"}</b>
          <div><b>Hotel:</b> {result.hotel}</div>
          <div><b>Habitación:</b> {result.room_type}</div>
          {result.checkin && <div><b>Fecha y hora de check-in:</b> {result.checkin}</div>}
          {result.checkout && <div><b>Fecha y hora de check-out:</b> {result.checkout}</div>}
        </div>
      )}
    </div>
  );
}

