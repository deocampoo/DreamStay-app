"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";

const NAME_REGEX = /^[\p{L} ]+$/u;
const CAPACITY = {
  Single: { adults: 1, children: 0, babies: 0 },
  Doble: { adults: 2, children: 1, babies: 0 },
  Suite: { adults: 3, children: 2, babies: 1 },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

function parseBirth(value) {
  if (!value) return null;
  if (value.includes("/")) {
    const parts = value.split("/").map((part) => part.trim());
    if (parts.length !== 3) return null;
    let [first, second, year] = parts;
    if (!first || !second || !year) return null;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    if (Number.isNaN(firstNum) || Number.isNaN(secondNum)) return null;
    let day = first;
    let month = second;
    if (firstNum <= 12 && secondNum > 12) {
      day = second;
      month = first;
    } else if (firstNum > 12 && secondNum <= 12) {
      day = first;
      month = second;
    }
    const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatToDMY(value) {
  if (!value) return "";
  const date = parseBirth(value);
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getGuestInfo(guest) {
  const birthDate = parseBirth(guest.birth);
  if (!birthDate) {
    return { age: null, category: null, isMinor: false, isFuture: false };
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  if (age < 0) {
    return { age: null, category: null, isMinor: false, isFuture: true };
  }
  let category = "adult";
  if (age < 18) {
    category = age >= 2 ? "child" : "baby";
  }
  return { age, category, isMinor: age < 18, isFuture: false };
}

function getCategoryLabel(category) {
  if (category === "adult") return "Adulto";
  if (category === "child") return "Niño";
  if (category === "baby") return "Bebé";
  return "Sin clasificar";
}

export default function GuestFormModal({ hotel, room, checkin, checkout, onClose, onReservationConfirmed, onPricePreview }) {
  const [guests, setGuests] = useState([{ name: "", birth: "" }]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [contactEmail, setContactEmail] = useState("");
  const [contactEmailError, setContactEmailError] = useState("");

  const capacity = useMemo(() => CAPACITY[room?.type] || CAPACITY.Single, [room?.type]);
  const totalCapacity = capacity.adults + capacity.children + capacity.babies;

  const birthSignature = useMemo(() => guests.map((guest) => guest.birth).join("|"), [guests]);
  const guestInfos = useMemo(() => guests.map(getGuestInfo), [birthSignature]);
  const summary = useMemo(() => {
    const totals = { adult: 0, child: 0, baby: 0 };
    guestInfos.forEach((info) => {
      if (info && info.category) {
        totals[info.category] += 1;
      }
    });
    return totals;
  }, [guestInfos]);

  const summarySignature = `${summary.adult}-${summary.child}-${summary.baby}`;
  const roomSignature = `${hotel?.hotel || hotel?.name || ""}|${room?.name || ""}|${room?.type || ""}`;
  const onPricePreviewRef = useRef(onPricePreview);

  useEffect(() => {
    onPricePreviewRef.current = onPricePreview;
  }, [onPricePreview]);

  useEffect(() => {
    const publishPreview = (value) => {
      if (typeof onPricePreviewRef.current === "function") {
        onPricePreviewRef.current(value);
      }
    };
    if (confirmation) {
      return;
    }
    if (!hotel || !room || !checkin || !checkout) {
      publishPreview(null);
      return;
    }
    const allAgesKnown = guestInfos.every((info) => info.age !== null && !info.isFuture);
    const exceedsCapacity =
      summary.adult > capacity.adults || summary.child > capacity.children || summary.baby > capacity.babies;
    if (!allAgesKnown || summary.adult < 1 || exceedsCapacity) {
      publishPreview(null);
      return;
    }
    const controller = new AbortController();
    const payload = {
      hotel: hotel.hotel || hotel.name,
      room_type: room.type,
      checkin,
      checkout,
      counts: summary,
    };
    const fetchPreview = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/price-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("preview");
        }
        const data = await response.json();
        publishPreview(data.price_detail || null);
      } catch (error) {
        if (error.name === "AbortError") return;
        publishPreview(null);
      }
    };
    fetchPreview();
    return () => {
      controller.abort();
    };
  }, [
    roomSignature,
    checkin,
    checkout,
    summarySignature,
    birthSignature,
    capacity.adults,
    capacity.children,
    capacity.babies,
    confirmation,
  ]);

  const validate = () => {
    const validationErrors = [];
    const today = new Date();
    const counts = { adult: 0, child: 0, baby: 0 };

    guests.forEach((guest, idx) => {
      const position = idx + 1;
      const name = (guest.name || "").trim();
      if (!name) {
        validationErrors.push(`Nombre del huésped ${position} es obligatorio.`);
      } else if (!NAME_REGEX.test(name)) {
        validationErrors.push(`Nombre del huésped ${position} solo admite letras y espacios.`);
      }

      if (!guest.birth) {
        validationErrors.push(`Fecha de nacimiento del huésped ${position} es obligatoria.`);
        return;
      }
      const birthDate = parseBirth(guest.birth);
      if (!birthDate) {
        validationErrors.push(`Fecha de nacimiento del huésped ${position} debe tener formato válido (dd/mm/yyyy).`);
        return;
      }
      let age = today.getFullYear() - birthDate.getFullYear();
      const beforeBirthday =
        today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
      if (beforeBirthday) age -= 1;
      if (age < 0) {
        validationErrors.push(`Fecha de nacimiento del huésped ${position} no puede ser futura.`);
        return;
      }
      if (age >= 18) counts.adult += 1;
      else if (age >= 2) counts.child += 1;
      else counts.baby += 1;
    });

    if (counts.adult === 0) {
      validationErrors.push("Debe haber al menos un adulto en la reserva.");
    }

    if (counts.adult > capacity.adults || counts.child > capacity.children || counts.baby > capacity.babies) {
      validationErrors.push("La cantidad de huéspedes supera la capacidad de esta habitación.");
    }

    if (guests.length > totalCapacity) {
      validationErrors.push("No se pueden registrar más huéspedes que la capacidad total de la habitación.");
    }

    let emailError = "";
    const trimmedEmail = contactEmail.trim();
    if (!trimmedEmail) {
      emailError = "El correo de contacto es obligatorio.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      emailError = "El correo de contacto debe tener un formato valido.";
    }

    return { validationErrors, counts, emailError };
  };

  const handleChange = (idx, field, value) => {
    setGuests((prev) => prev.map((guest, index) => (index === idx ? { ...guest, [field]: value } : guest)));
  };

  const handleAddGuest = () => {
    if (guests.length >= totalCapacity) {
      setErrors((prev) => {
        const message = "No se pueden agregar más huéspedes para esta habitación.";
        return prev.includes(message) ? prev : [...prev, message];
      });
      return;
    }
    setGuests((prev) => [...prev, { name: "", birth: "" }]);
  };

  const handleRemoveGuest = (idx) => {
    setGuests((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { validationErrors, emailError } = validate();
    setErrors(validationErrors);
    setContactEmailError(emailError);
    if (validationErrors.length > 0 || emailError) return;

    setLoading(true);
    setConfirmation(null);

    try {
      const payloadGuests = guests.map((guest) => ({
        name: guest.name.trim(),
        birth: formatToDMY(guest.birth),
      }));
      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel: hotel.hotel || hotel.name,
          room_type: room.type,
          checkin,
          checkout,
          guests: payloadGuests,
          contact_email: contactEmail.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const serverErrors = data.errors || (data.error ? [data.error] : [data.message || "Error de reserva"]);
        setErrors(serverErrors);
      } else {
        if (typeof onReservationConfirmed === "function") {
          onReservationConfirmed(data);
        }
        setConfirmation(data);
        setErrors([]);
      }
    } catch (error) {
      console.error('Error al invocar reservas', error);
      setErrors(["Error de conexión con el backend"]);
    }

    setLoading(false);
  };

  const minorLabel = "¿Es menor de 18 años?";
  const disableAddGuest = guests.length >= totalCapacity;

  if (confirmation) {
    const detail = confirmation.price_detail || {};
    const counts = detail.counts || {};
    const perNight = detail.per_night || {};
    const formatValue = (value) => {
      if (typeof value === "number") {
        return value.toFixed(2);
      }
      return value ?? "0";
    };
    return (
      <div style={{ color: "#0f172a" }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Reserva confirmada</div>
        <div><b>Código de confirmación:</b> {confirmation.confirmation_code}</div>
        <div><b>Hotel:</b> {confirmation.hotel}</div>
        <div><b>Habitación:</b> {confirmation.room_type}</div>
        <div><b>Check-in:</b> {confirmation.checkin}</div>
        <div><b>Check-out:</b> {confirmation.checkout}</div>
        <div style={{ marginTop: 12 }}>
          <b>Detalle de huéspedes:</b>
          {confirmation.guests && confirmation.guests.map((guest, index) => (
            <div key={index} style={{ marginTop: 4 }}>
              {guest.name} - Edad: {guest.age ?? "-"} - Categoría: {getCategoryLabel(guest.category)}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <b>Detalle de precio:</b>
          <div>Noches: {detail.nights ?? "-"}</div>
          <div>Adultos: {counts.adult ?? 0} x ${formatValue(perNight.adult)}</div>
          <div>Niños: {counts.child ?? 0} x ${formatValue(perNight.child)}</div>
          <div>Bebés: {counts.baby ?? 0} x ${formatValue(perNight.baby)}</div>
          <div>Subtotal por noche: ${formatValue(detail.subtotal_per_night)}</div>
          <div>Total: ${formatValue(detail.total ?? confirmation.total)}</div>
          {confirmation.offer && <div>Oferta aplicada: {confirmation.offer}</div>}
        </div>
        <button
          onClick={onClose}
          style={{ marginTop: 18, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 600, cursor: "pointer" }}
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12, color: "#0f172a" }}>
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6, color: "#0f172a" }}>
        <label htmlFor="contact-email" style={{ fontWeight: 500, fontSize: 15 }}>
          Correo de contacto
        </label>
        <input
          id="contact-email"
          type="email"
          value={contactEmail}
          onChange={(event) => {
            setContactEmail(event.target.value);
            if (contactEmailError) {
              setContactEmailError("");
            }
          }}
          placeholder="ejemplo@correo.com"
          style={{ borderRadius: 8, border: contactEmailError ? "2px solid #DC2626" : "1px solid #ccc", padding: 10 }}
          required
        />
        <div style={{ fontSize: 13, color: "#475569" }}>
          Utilizaremos este correo para enviarte el resumen o recuperar la reserva.
        </div>
        {contactEmailError && (
          <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">
            {contactEmailError}
          </div>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 10, color: "#0f172a" }}>Datos de los huéspedes</div>
      {guests.map((guest, index) => {
        const info = getGuestInfo(guest);
        return (
          <div key={index} style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={guest.name}
              onChange={(event) => handleChange(index, "name", event.target.value)}
              style={{ borderRadius: 8, border: "1px solid #ccc", padding: 8, width: 200 }}
              required
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13 }}>Fecha de nacimiento</label>
              <input
                type="date"
                value={guest.birth}
                onChange={(event) => handleChange(index, "birth", event.target.value)}
                style={{ borderRadius: 8, border: "1px solid #ccc", padding: 8, width: 180 }}
                required
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={info.isMinor} readOnly /> {minorLabel}
              </label>
              <div style={{ fontSize: 13 }}>Categoría: {getCategoryLabel(info.category)}</div>
              <div style={{ fontSize: 13 }}>Edad calculada: {info.age ?? "-"}</div>
            </div>
            {guests.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveGuest(index)}
                style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 600, cursor: "pointer", height: 38 }}
              >
                Eliminar
              </button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        Distribución actual: Adultos {summary.adult}, Niños {summary.child}, Bebés {summary.baby}. Capacidad máxima: Adultos {capacity.adults}, Niños {capacity.children}, Bebés {capacity.babies}.
      </div>
      <button
        type="button"
        onClick={handleAddGuest}
        disabled={disableAddGuest}
        style={{ background: disableAddGuest ? "#9ca3af" : "#16A34A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: disableAddGuest ? "not-allowed" : "pointer", marginBottom: 10 }}
      >
        Agregar huésped
      </button>
      {disableAddGuest && (
        <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 8 }}>
          Capacidad máxima alcanzada para esta habitación.
        </div>
      )}
      {errors.length > 0 && (
        <div style={{ color: "#DC2626", marginBottom: 10 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 600, cursor: loading ? "wait" : "pointer", marginTop: 8 }}
      >
        {loading ? "Confirmando..." : "Confirmar reserva"}
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{ marginLeft: 10, background: "#64748b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 600, cursor: "pointer", marginTop: 8 }}
      >
        Cancelar
      </button>
    </form>
  );
}


