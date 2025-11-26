"use client";

import React, { useState, useEffect } from "react";

const ROOM_TYPES = [
  { value: "Single", label: "Habitación Single" },
  { value: "Doble", label: "Habitación Doble" },
  { value: "Suite", label: "Suite" },
];

const CAPACITY = {
  Single: { adults: 1, children: 0, babies: 0 },
  Doble: { adults: 2, children: 1, babies: 0 },
  Suite: { adults: 3, children: 2, babies: 1 },
};

const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5000"
    : "https://dreamstay-app.onrender.com";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/$/, "");

function toInputDate(value) {
  if (!value) return "";
  if (value.includes("/")) {
    const [day, month, year] = value.split("/");
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return value;
}

function formatCurrencySafe(value, formatter) {
  if (typeof formatter === "function") return formatter(value);
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

export default function ModifyReservationModal({ open, reservation, onClose, onSuccess, currencyFormatter }) {
  const [form, setForm] = useState({
    checkin: "",
    checkout: "",
    room_type: "Single",
    adult: 1,
    child: 0,
    baby: 0,
  });
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (reservation && open) {
      setForm({
        checkin: toInputDate(reservation.checkin),
        checkout: toInputDate(reservation.checkout),
        room_type: reservation.room_type || "Single",
        adult: reservation.counts?.adult ?? 1,
        child: reservation.counts?.child ?? 0,
        baby: reservation.counts?.baby ?? 0,
      });
      setPreview(null);
      setPreviewError("");
      setSubmitFeedback({ type: "", text: "" });
    }
  }, [reservation, open]);

  useEffect(() => {
    if (!open || !reservation) return;
    if (!form.checkin || !form.checkout) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    const controller = new AbortController();
    const fetchPreview = async () => {
      setLoadingPreview(true);
      setPreviewError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/reservations/modify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation_code: reservation.confirmation_code,
            email: reservation.contact_email || "",
            checkin: form.checkin,
            checkout: form.checkout,
            room_type: form.room_type,
            counts: { adult: form.adult, child: form.child, baby: form.baby },
            preview_only: true,
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          setPreview(null);
          setPreviewError(data.error || "No hay disponibilidad para los parametros seleccionados.");
        } else {
          setPreview(data.preview || null);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setPreview(null);
          setPreviewError("No pudimos obtener la previsualizacion. Intentá nuevamente.");
        }
      }
      setLoadingPreview(false);
    };
    fetchPreview();
    return () => controller.abort();
  }, [open, reservation, form.checkin, form.checkout, form.room_type, form.adult, form.child, form.baby]);

  if (!open || !reservation) return null;

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: ["adult", "child", "baby"].includes(name) ? Math.max(0, parseInt(value, 10) || 0) : value,
    }));
    setSubmitFeedback({ type: "", text: "" });
  };

  const capacity = CAPACITY[form.room_type] || CAPACITY.Single;
  const capacityWarning =
    form.adult > capacity.adults || form.child > capacity.children || form.baby > capacity.babies
      ? "La capacidad de la habitacion seleccionada es menor que la nueva ocupacion."
      : "";

  const canSubmit =
    !loadingPreview &&
    !submitting &&
    preview &&
    !capacityWarning &&
    !previewError &&
    form.adult >= 1 &&
    form.checkin &&
    form.checkout;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitFeedback({ type: "", text: "" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_code: reservation.confirmation_code,
          email: reservation.contact_email || "",
          checkin: form.checkin,
          checkout: form.checkout,
          room_type: form.room_type,
          counts: { adult: form.adult, child: form.child, baby: form.baby },
          preview_only: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitFeedback({ type: "error", text: data.error || "No fue posible modificar la reserva." });
      } else {
        setSubmitFeedback({ type: "success", text: data.message || "Reserva actualizada." });
        if (typeof onSuccess === "function") {
          onSuccess(data);
        }
      }
    } catch (error) {
      setSubmitFeedback({ type: "error", text: "Error de conexion. Intentá nuevamente." });
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 1600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "min(640px, 100%)", maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 30px 80px rgba(15,23,42,0.25)", color: "#0f172a" }}>
        <button onClick={onClose} aria-label="Cerrar modificacion" style={{ position: "absolute", top: 14, right: 18, border: "none", background: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer" }}>
          ×
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Modificar Reserva</div>
        <p style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>
          Ajusta las fechas, el tipo de habitación o la ocupación. El estado de la reserva seguirá siendo confirmado.
        </p>

        <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Check-in</label>
            <input type="date" name="checkin" value={form.checkin} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Check-out</label>
            <input type="date" name="checkout" value={form.checkout} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Tipo de habitación</label>
            <select name="room_type" value={form.room_type} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }}>
              {ROOM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Adultos</label>
            <input type="number" min={1} name="adult" value={form.adult} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Niños</label>
            <input type="number" min={0} name="child" value={form.child} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontWeight: 500 }}>Bebés</label>
            <input type="number" min={0} name="baby" value={form.baby} onChange={handleInputChange} style={{ borderRadius: 10, border: "1px solid #cbd5f5", padding: 10 }} />
          </div>
        </div>
        {capacityWarning && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 6 }}>{capacityWarning}</div>}

        <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Previsualización del cambio</div>
          {loadingPreview && <div style={{ color: "#475569" }}>Recalculando disponibilidad...</div>}
          {!loadingPreview && previewError && <div style={{ color: "#DC2626" }}>{previewError}</div>}
          {!loadingPreview && !previewError && preview && (
            <div style={{ color: "#0f172a", lineHeight: 1.5 }}>
              <div>Nuevos totales: {formatCurrencySafe(preview.new_total, currencyFormatter)}</div>
              <div>Diferencia: {formatCurrencySafe(preview.difference, currencyFormatter)}</div>
              {preview.payment_action === "charge" && (
                <div>Se requerirá un pago adicional por la diferencia.</div>
              )}
              {preview.payment_action === "refund" && (
                <div>Se reintegrará {formatCurrencySafe(preview.refund_amount, currencyFormatter)}.</div>
              )}
              {preview.payment_action === "no_refund" && (
                <div>La diferencia a favor no es reembolsable por estar dentro de las 24 h previas.</div>
              )}
            </div>
          )}
        </div>

        {submitFeedback.text && (
          <div style={{ marginTop: 14, color: submitFeedback.type === "error" ? "#DC2626" : "#15803d", fontWeight: 500 }}>
            {submitFeedback.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ borderRadius: 999, border: "1px solid #94a3b8", color: "#475569", padding: "10px 20px", background: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              borderRadius: 999,
              border: "none",
              padding: "10px 24px",
              fontWeight: 600,
              background: canSubmit ? "#2563EB" : "#94a3b8",
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Guardando..." : "Confirmar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
