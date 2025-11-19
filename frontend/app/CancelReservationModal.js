"use client";

import React, { useState, useEffect } from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

function formatCurrency(value, formatter) {
  if (typeof formatter === "function") return formatter(value);
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

export default function CancelReservationModal({ open, reservation, onClose, onSuccess, currencyFormatter }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setFeedback({ type: "", text: "" });
      setResult(null);
      setLoading(false);
    }
  }, [open]);

  if (!open || !reservation) return null;

  const handleCancel = async () => {
    setLoading(true);
    setFeedback({ type: "", text: "" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_code: reservation.confirmation_code,
          email: reservation.contact_email || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback({ type: "error", text: data.error || "No se pudo cancelar la reserva." });
      } else {
        setFeedback({ type: "success", text: data.message || "Reserva cancelada." });
        setResult(data.refund || null);
        if (typeof onSuccess === "function") {
          onSuccess(data);
        }
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Error de conexion. Intentá nuevamente." });
    }
    setLoading(false);
  };

  const refundLabel = result
    ? result.amount > 0
      ? `Se reintegrarán ${formatCurrency(result.amount, currencyFormatter)} (${result.policy}).`
      : `Sin reembolso (${result.policy}).`
    : "";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "min(480px, 100%)", boxShadow: "0 30px 80px rgba(15,23,42,0.25)", position: "relative", color: "#0f172a" }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer" }}>
          ×
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Cancelar Reserva</h2>
        <p style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>
          Esta acción liberará la habitación asociada. Confirmá si realmente no vas a utilizar la estadía.
        </p>

        <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, fontSize: 14, marginTop: 16, color: "#0f172a" }}>
          <div><strong>Código:</strong> {reservation.confirmation_code}</div>
          <div><strong>Hotel:</strong> {reservation.hotel}</div>
          <div><strong>Check-in:</strong> {reservation.checkin || "-"}</div>
          <div><strong>Total abonado:</strong> {formatCurrency(reservation.total ?? reservation.price_detail?.total ?? 0, currencyFormatter)}</div>
        </div>

        <div style={{ marginTop: 16, fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
          <strong>Política de cancelación:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 20, color: "#475569" }}>
            <li>Hasta 24 hs antes del check-in: reembolso total.</li>
            <li>Dentro de las 24 hs previas: sin reembolso.</li>
          </ul>
        </div>

        {feedback.text && (
          <div style={{ marginTop: 16, color: feedback.type === "error" ? "#DC2626" : "#15803d", fontWeight: 500 }}>
            {feedback.text}
            {feedback.type === "success" && refundLabel && <div style={{ fontSize: 13 }}>{refundLabel}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ borderRadius: 999, border: "1px solid #94a3b8", color: "#475569", padding: "10px 20px", background: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading || feedback.type === "success"}
            style={{ borderRadius: 999, border: "none", padding: "10px 24px", fontWeight: 600, background: "#DC2626", color: "#fff", cursor: loading || feedback.type === "success" ? "not-allowed" : "pointer" }}
          >
            {loading ? "Cancelando..." : "Cancelar Reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}
