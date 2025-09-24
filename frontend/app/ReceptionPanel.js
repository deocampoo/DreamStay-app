import React, { useState } from "react";

export default function ReceptionPanel() {
  const [code, setCode] = useState("");
  const [action, setAction] = useState("checkin");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`http://localhost:5000/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_code: code })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Error inesperado");
      else setResult(data);
    } catch (err) {
      setError("Error de conexión con el backend");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px #0001" }}>
      <h2 style={{ marginBottom: 18 }}>Panel de Recepción</h2>
      <form onSubmit={handleSubmit}>
        <label style={{ fontWeight: 500 }}>Código de confirmación:</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12 }}
          required
        />
        <div style={{ marginBottom: 12 }}>
          <label>
            <input type="radio" name="action" value="checkin" checked={action === "checkin"} onChange={() => setAction("checkin")} /> Check-in
          </label>
          <label style={{ marginLeft: 18 }}>
            <input type="radio" name="action" value="checkout" checked={action === "checkout"} onChange={() => setAction("checkout")} /> Check-out
          </label>
        </div>
        <button type="submit" disabled={loading} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? "Procesando..." : action === "checkin" ? "Registrar Check-in" : "Registrar Check-out"}
        </button>
      </form>
      {error && <div style={{ color: '#DC2626', marginTop: 14 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 18, background: '#F3F4F6', padding: 14, borderRadius: 8 }}>
          <b>{action === "checkin" ? "Check-in realizado" : "Check-out realizado"}</b><br />
          <div><b>Hotel:</b> {result.hotel}</div>
          <div><b>Habitación:</b> {result.room_type}</div>
          {result.checkin && <div><b>Fecha y hora de check-in:</b> {result.checkin}</div>}
          {result.checkout && <div><b>Fecha y hora de check-out:</b> {result.checkout}</div>}
        </div>
      )}
    </div>
  );
}
