"use client";

import React from "react";

const STATUS_INFO = {
  pendiente_pago: {
    label: "Pendiente de pago",
    color: "#F97316",
    actions: ["pay"],
    description: "Tu reserva esta registrada. Completa el pago para confirmarla.",
    policy: "La disponibilidad se mantiene por 24 horas o hasta que acredites el pago.",
  },
  confirmada: {
    label: "Confirmada",
    color: "#16A34A",
    actions: ["modify", "cancel"],
    description: "Reserva confirmada. Podes modificarla o cancelarla segun tus necesidades.",
    policy: "Los cambios estan sujetos a disponibilidad y pueden aplicar cargos segun la politica del hotel.",
  },
  ocupada: {
    label: "Check-in registrado",
    color: "#2563EB",
    actions: ["checkout"],
    description: "La habitacion esta ocupada actualmente.",
    policy: "Recorda iniciar el check-out a tiempo para evitar cargos extra.",
  },
  cancelada: {
    label: "Cancelada",
    color: "#94A3B8",
    actions: [],
    description: "La reserva fue cancelada. Conserva este resumen como comprobante.",
    policy: "No se permiten nuevas acciones sobre reservas canceladas.",
  },
  completada: {
    label: "Check-out finalizado",
    color: "#0F172A",
    actions: [],
    description: "La estadia finalizo correctamente. Los datos quedan disponibles para consulta.",
    policy: "Comunicate con recepcion si necesitas un comprobante o factura.",
  },
};

const ACTION_LABELS = {
  pay: "Pagar Reserva",
  modify: "Modificar Reserva",
  cancel: "Cancelar Reserva",
  checkout: "Check-out",
};

const ACTION_COLORS = {
  pay: "#F97316",
  modify: "#2563EB",
  cancel: "#DC2626",
  checkout: "#0EA5E9",
};

const fallbackFormatCurrency = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

export default function ReservationSummaryCard({ reservation, onAction = {}, currencyFormatter }) {
  if (!reservation) {
    return null;
  }

  const formatMoney =
    typeof currencyFormatter === "function" ? currencyFormatter : fallbackFormatCurrency;
  const normalizedStatus = (reservation.status || "").toLowerCase();
  const statusInfo =
    STATUS_INFO[normalizedStatus] ||
    {
      label: reservation.status || "Estado desconocido",
      color: "#475569",
      actions: [],
      description: "Consulta la informacion registrada para tu reserva.",
      policy: "Comunicate con recepcion para obtener mas detalles.",
    };

  const detail = reservation.price_detail || {};
  const counts = reservation.counts || detail.counts || {};
  const nights = reservation.nights || detail.nights || 1;
  const guestList = Array.isArray(reservation.guests) ? reservation.guests : [];
  const totalGuests =
    guestList.length || (counts.adult || 0) + (counts.child || 0) + (counts.baby || 0);
  const contactEmail = reservation.contact_email || reservation.email || "No informado";
  const distributionLabel = `Adultos ${counts.adult ?? 0} | Ninos ${counts.child ?? 0} | Bebes ${counts.baby ?? 0}`;

  const actionKeys = (statusInfo.actions || []).filter((key) => {
    if (key === "modify" && reservation.allow_modify === false) return false;
    if (key === "cancel" && reservation.allow_cancel === false) return false;
    return true;
  });

  const handleActionClick = (actionKey) => {
    const handler = onAction[actionKey];
    if (typeof handler === "function") {
      handler(reservation);
    }
  };

  const renderPriceRow = (label, value, bold = false) => (
    <div
      key={label}
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 14,
        fontWeight: bold ? 600 : 400,
        color: bold ? "#0f172a" : "#475569",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const perNight = detail.per_night || {};

  return (
    <section
      aria-label="Resumen de la reserva"
      style={{
        marginTop: 24,
        padding: 24,
        borderRadius: 20,
        background: "#fff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxHeight: "80vh",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: "#475569" }}>
            Resumen de reserva
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "#0f172a" }}>
            {reservation.confirmation_code || "Sin codigo"}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>Correo: {contactEmail}</div>
        </div>
        <span
          style={{
            padding: "6px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: statusInfo.color,
            whiteSpace: "nowrap",
          }}
        >
          {statusInfo.label}
        </span>
      </header>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, minHeight: 0 }}>
        <div style={{ color: "#0f172a", fontSize: 15 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{reservation.hotel}</div>
          <div>Habitacion: <strong>{reservation.room_name || reservation.room_type}</strong></div>
          <div>
            Check-in <strong>{reservation.checkin || "-"}</strong> - Check-out{" "}
            <strong>{reservation.checkout || "-"}</strong> ({nights} noche{nights !== 1 ? "s" : ""})
          </div>
          <div>Huespedes: <strong>{totalGuests}</strong></div>
          <div>Distribucion: <strong>{distributionLabel}</strong></div>
          {reservation.offer && (
            <div>Oferta aplicada: <strong>{reservation.offer}</strong></div>
          )}
        </div>

        <p style={{ marginTop: 12, fontSize: 14, color: "#334155" }}>{statusInfo.description}</p>

        <div
          style={{
            marginTop: 16,
            background: "#f8fafc",
            borderRadius: 16,
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          {renderPriceRow("Noches", nights)}
          {renderPriceRow("Total", formatMoney(reservation.total ?? detail.total ?? 0), true)}
          {renderPriceRow(
            "Subtotal por noche",
            formatMoney(detail.subtotal_per_night ?? detail.total ?? 0)
          )}
          <div style={{ fontSize: 13, color: "#334155" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Detalle por categoria</div>
            <div>Adultos: {counts.adult ?? 0} x {formatMoney(perNight.adult ?? 0)}</div>
            <div>Ninos: {counts.child ?? 0} x {formatMoney(perNight.child ?? 0)}</div>
            <div>Bebes: {counts.baby ?? 0} x {formatMoney(perNight.baby ?? 0)}</div>
          </div>
        </div>

        {statusInfo.policy && (
          <div
            style={{
              marginTop: 12,
              background: "#fff7ed",
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: "#9a3412",
              border: "1px solid #fed7aa",
            }}
          >
            <strong>Politica:</strong> {statusInfo.policy}
          </div>
        )}

        {guestList.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Detalle de huespedes</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 14 }}>
              {guestList.map((guest, index) => (
                <li key={`${guest.name}-${index}`}>
                  {guest.name} ({guest.category || "sin categoria"}) - Edad: {guest.age ?? "-"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
        {actionKeys.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {actionKeys.map((actionKey) => {
              const handler = onAction[actionKey];
              const disabled = typeof handler !== "function";
              return (
                <button
                  type="button"
                  key={actionKey}
                  onClick={() => handleActionClick(actionKey)}
                  disabled={disabled}
                  style={{
                    background: ACTION_COLORS[actionKey] || "#2563EB",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "10px 22px",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.65 : 1,
                    boxShadow: "0 10px 20px rgba(15,23,42,0.12)",
                  }}
                >
                  {ACTION_LABELS[actionKey] || actionKey}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#475569" }}>
            No hay acciones disponibles para el estado actual de la reserva.
          </div>
        )}
      </div>
    </section>
  );
}

