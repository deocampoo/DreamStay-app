"use client";

import React, { useState, useEffect, useMemo } from "react";

const NAME_REGEX = /^[\p{L} ]+$/u;
const CARD_REGEX = /^[0-9]{13,19}$/;
const CVV_REGEX = /^[0-9]{3,4}$/;
const EXP_REGEX = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

function formatCurrencySafe(value, formatter) {
  if (typeof formatter === "function") return formatter(value);
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

function formatCardNumber(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiration(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function PaymentModal({ open, reservation, onClose, onSuccess, currencyFormatter }) {
  const total = reservation?.total ?? reservation?.price_detail?.total ?? 0;
  const [form, setForm] = useState({
    cardholder: "",
    card_number: "",
    expiration: "",
    cvv: "",
    email: reservation?.contact_email || "",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (reservation) {
      setForm({
        cardholder: "",
        card_number: "",
        expiration: "",
        cvv: "",
        email: reservation.contact_email || "",
      });
      setErrors({});
      setSubmitError("");
      setSuccessMessage("");
      setReceipt(null);
    }
  }, [reservation]);

  if (!open || !reservation) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    let nextValue = value;
    if (name === "card_number") {
      nextValue = formatCardNumber(value);
    } else if (name === "expiration") {
      nextValue = formatExpiration(value);
    }
    setForm((prev) => ({ ...prev, [name]: nextValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setSubmitError("");
  };

  const validate = () => {
    const validation = {};
    if (!form.cardholder.trim() || !NAME_REGEX.test(form.cardholder.trim())) {
      validation.cardholder = "El nombre del titular solo admite letras y espacios.";
    }
    const digits = form.card_number.replace(/\s|-/g, "");
    if (!CARD_REGEX.test(digits)) {
      validation.card_number = "El número de tarjeta debe tener entre 13 y 19 dígitos.";
    }
    if (!EXP_REGEX.test(form.expiration.trim())) {
      validation.expiration = "La fecha debe tener formato MM/AA.";
    } else {
      const [, month, year] = EXP_REGEX.exec(form.expiration.trim());
      const expMonth = Number(month);
      const expYear = 2000 + Number(year);
      const today = new Date();
      if (expYear < today.getFullYear() || (expYear === today.getFullYear() && expMonth < today.getMonth() + 1)) {
        validation.expiration = "La tarjeta debe estar vigente.";
      }
    }
    if (!CVV_REGEX.test(form.cvv.trim())) {
      validation.cvv = "El CVV debe tener 3 o 4 dígitos.";
    }
    if (!form.email.trim() || !EMAIL_REGEX.test(form.email.trim())) {
      validation.email = "Ingresá un correo válido para recibir el comprobante.";
    }
    return validation;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    setSubmitError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_code: reservation.confirmation_code,
          email: reservation.contact_email || "",
          cardholder: form.cardholder.trim(),
          card_number: form.card_number.replace(/\s|-/g, ""),
          expiration: form.expiration.trim(),
          cvv: form.cvv.trim(),
          receipt_email: form.email.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = Array.isArray(data.errors) ? data.errors.join(" ") : data.error || "No fue posible procesar el pago.";
        setSubmitError(message);
      } else {
        setSuccessMessage(data.message || "Pago realizado con éxito. Tu reserva quedó confirmada.");
        setReceipt(data.receipt || null);
        if (typeof onSuccess === "function") {
          onSuccess(data);
        }
      }
    } catch (error) {
      setSubmitError("No pudimos conectar con el servidor. Intentá nuevamente.");
    }
    setLoading(false);
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;
    const lines = [
      "Comprobante de pago DreamStay",
      `Código: ${receipt.confirmation_code}`,
      `Fecha: ${receipt.paid_at}`,
      `Monto: ${formatCurrencySafe(receipt.amount, currencyFormatter)}`,
      `Tarjeta: **** **** **** ${receipt.card_last4}`,
      `Titular: ${receipt.cardholder}`,
      `Enviado a: ${receipt.receipt_email}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprobante-${receipt.confirmation_code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 30px 80px rgba(15,23,42,0.25)", color: "#0f172a" }}>
        <button onClick={onClose} aria-label="Cerrar pago" style={{ position: "absolute", top: 16, right: 16, border: "none", background: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer" }}>
          ×
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Pagar Reserva</div>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>Procesamos tu pago de manera segura. Este flujo es una simulación, no almacenamos los datos de tu tarjeta.</p>

        <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 16, padding: 16, fontSize: 14, color: "#0f172a" }}>
          <div style={{ fontWeight: 600 }}>{reservation.hotel}</div>
          <div>Código: <strong>{reservation.confirmation_code}</strong></div>
          <div>Total a pagar: <strong>{formatCurrencySafe(total, currencyFormatter)}</strong></div>
        </div>

        {successMessage ? (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 16, border: "1px solid #bbf7d0", background: "#dcfce7" }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#166534" }}>{successMessage}</div>
            {receipt && (
              <div style={{ marginTop: 12, fontSize: 14, color: "#166534", lineHeight: 1.6 }}>
                <div>Fecha: {receipt.paid_at}</div>
                <div>Monto: {formatCurrencySafe(receipt.amount, currencyFormatter)}</div>
                <div>Tarjeta: **** **** **** {receipt.card_last4}</div>
                <div>Comprobante enviado a: {receipt.receipt_email}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleDownloadReceipt}
                disabled={!receipt}
                style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 999, padding: "10px 20px", fontWeight: 600, cursor: receipt ? "pointer" : "not-allowed" }}
              >
                Descargar comprobante
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ borderRadius: 999, border: "1px solid #0f172a", color: "#0f172a", padding: "10px 22px", background: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Nombre y apellido del titular</label>
              <input
                type="text"
                name="cardholder"
                value={form.cardholder}
                onChange={handleChange}
                placeholder="Ej: Juan Pérez"
                style={{ borderRadius: 10, border: errors.cardholder ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10 }}
                required
              />
              {errors.cardholder && <div style={{ color: "#DC2626", fontSize: 13 }}>{errors.cardholder}</div>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Número de tarjeta</label>
              <input
                type="text"
                name="card_number"
                value={form.card_number}
                onChange={handleChange}
                placeholder="0000 0000 0000 0000"
                style={{ borderRadius: 10, border: errors.card_number ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10 }}
                required
              />
              {errors.card_number && <div style={{ color: "#DC2626", fontSize: 13 }}>{errors.card_number}</div>}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Vencimiento (MM/AA)</label>
                <input
                  type="text"
                  name="expiration"
                  value={form.expiration}
                  onChange={handleChange}
                  placeholder="08/27"
                  style={{ borderRadius: 10, border: errors.expiration ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10 }}
                  required
                />
                {errors.expiration && <div style={{ color: "#DC2626", fontSize: 13 }}>{errors.expiration}</div>}
              </div>
              <div style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>CVV</label>
                <input
                  type="text"
                  name="cvv"
                  value={form.cvv}
                  onChange={handleChange}
                  placeholder="123"
                  style={{ borderRadius: 10, border: errors.cvv ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10 }}
                  required
                />
                {errors.cvv && <div style={{ color: "#DC2626", fontSize: 13 }}>{errors.cvv}</div>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Email para comprobante</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu-email@dominio.com"
                style={{ borderRadius: 10, border: errors.email ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10 }}
                required
              />
              {errors.email && <div style={{ color: "#DC2626", fontSize: 13 }}>{errors.email}</div>}
            </div>

            {submitError && <div style={{ color: "#DC2626", fontSize: 14 }}>{submitError}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, background: "#2563EB", color: "#fff", border: "none", borderRadius: 999, padding: "12px 0", fontWeight: 600, cursor: loading ? "wait" : "pointer" }}
            >
              {loading ? "Procesando..." : `Pagar ${formatCurrencySafe(total, currencyFormatter)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
