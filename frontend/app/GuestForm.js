import React, { useState, useEffect } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GuestForm({ open, onClose, room }) {
  const [guests, setGuests] = useState([]);
  const [errors, setErrors] = useState([]);
  const [touched, setTouched] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    if (room) {
      // Usar la cantidad seleccionada por el usuario, no la capacidad máxima
      const adults = room.guestsCount?.adults || 0;
      const children = room.guestsCount?.children || 0;
      const babies = room.guestsCount?.babies || 0;
      const guestsArr = [];
      for (let i = 0; i < adults; i++) guestsArr.push({ name: "", birth: "", age: null, type: "Adulto" });
      for (let i = 0; i < children; i++) guestsArr.push({ name: "", birth: "", age: null, type: "Niño" });
      for (let i = 0; i < babies; i++) guestsArr.push({ name: "", birth: "", age: null, type: "Bebé" });
      setGuests(guestsArr);
      setErrors(Array.from({ length: guestsArr.length }, () => ({ name: "", birth: "" })));
      setTouched(Array.from({ length: guestsArr.length }, () => ({ name: false, birth: false })));
      setConfirmation(null);
    }
  }, [room]);

  const validateGuest = (guest) => {
    const err = { name: "", birth: "" };
    if (!guest.name.trim()) {
      err.name = "El nombre es obligatorio.";
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$/.test(guest.name)) {
      err.name = "Solo letras y espacios.";
    }
    if (!guest.birth) {
      err.birth = "La fecha es obligatoria.";
    } else {
      // Aceptar fechas válidas hasta hoy
      const birthDate = new Date(guest.birth);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (isNaN(birthDate.getTime())) {
        err.birth = "Formato inválido.";
      } else if (birthDate > today) {
        err.birth = "La fecha no puede ser futura.";
      } else {
        let age = today.getFullYear() - birthDate.getFullYear();
        const mDiff = today.getMonth() - birthDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) age--;
        guest.age = age;
        if (age < 0 || age > 120) {
          err.birth = "Fecha inválida.";
        }
      }
    }
    return err;
  };

  useEffect(() => {
    setErrors(guests.map(validateGuest));
  }, [guests]);

  const handleChange = (i, field, value) => {
    setGuests((prev) => prev.map((g, j) => j === i ? { ...g, [field]: value } : g));
    setTouched((prev) => prev.map((t, j) => j === i ? { ...t, [field]: true } : t));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(guests.map(() => ({ name: true, birth: true })));
    const errs = guests.map(validateGuest);
    setErrors(errs);
    if (errs.some((err) => err.name || err.birth)) {
      setSubmitError("Por favor corrige los errores antes de continuar.");
      return;
    }
    if (!guests.some((g) => g.type === "Adulto")) {
      setSubmitError("Debe haber al menos un adulto en la reserva.");
      return;
    }
    const trimmedEmail = contactEmail.trim();
    if (!trimmedEmail) {
      setSubmitError("El correo de contacto es obligatorio.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setSubmitError("El correo de contacto debe tener un formato valido.");
      return;
    }
    setSubmitError("");
    setLoading(true);
    setConfirmation(null);
    try {
      const res = await fetch("http://localhost:5000/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel: room?.hotel || room?.hotel_name || '',
          room_type: room.type,
          checkin: room.checkin || '',
          checkout: room.checkout || '',
          guests: guests.map(g => ({ name: g.name, birth: g.birth })),
          contact_email: trimmedEmail,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.errors ? data.errors.join(". ") : data.message || "Error al confirmar reserva");
      } else {
        setConfirmation(data);
        setContactEmail("");
      }
    } catch (err) {
      setSubmitError("Error de conexión con el backend");
    }
    setLoading(false);
  };

  if (!room) return null;

  if (confirmation) {
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: '#16A34A', marginBottom: 10 }}>¡Reserva confirmada!</div>
        <div style={{ fontSize: 17, marginBottom: 8 }}>Código: <b>{confirmation.confirmation_code}</b></div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Hotel: {confirmation.hotel}</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Habitación: {confirmation.room_type}</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Fechas: {confirmation.checkin} a {confirmation.checkout} ({confirmation.nights} noches)</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Huéspedes:</div>
        <ul style={{ textAlign: 'left', margin: '0 auto 8px auto', display: 'inline-block', padding: 0 }}>
          {confirmation.guests.map((g, idx) => (
            <li key={idx} style={{ fontSize: 15, marginBottom: 2 }}>{g.name} ({g.type})</li>
          ))}
        </ul>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Total: <b>${confirmation.total}</b></div>
        <button onClick={onClose} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 600, cursor: 'pointer', fontSize: 16, marginTop: 10 }}>Cerrar</button>
      </div>
    );
  }

  // Resumen antes de confirmar
  const allValid = guests.every((g, i) => !validateGuest(g).name && !validateGuest(g).birth && g.name && g.birth);
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 360 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="contact-email-inline" style={{ fontWeight: 600, fontSize: 14 }}>Correo de contacto</label>
        <input
          id="contact-email-inline"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="tucorreo@ejemplo.com"
          style={{ borderRadius: 8, border: '1px solid #cbd5f5', padding: 10 }}
          required
        />
        <span style={{ fontSize: 13, color: '#475569' }}>Lo usaremos para enviarte el resumen y recuperar tu reserva.</span>
      </div>
      {guests.map((guest, i) => (
        <div key={i} style={{ background: '#f1f5f9', borderRadius: 8, padding: 14, marginBottom: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Huésped {i + 1} <span style={{ color: '#2563EB', fontWeight: 500, fontSize: 13, marginLeft: 8 }}>{room.guestsCount && i < room.guestsCount.adults ? 'Adulto' : (room.guestsCount && i < room.guestsCount.adults + room.guestsCount.children ? 'Niño' : 'Bebé')}</span></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={guest.name}
              onChange={e => handleChange(i, 'name', e.target.value)}
              style={{ flex: 1, borderRadius: 6, border: errors[i]?.name ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, fontSize: 15 }}
              aria-label="Nombre completo"
              required
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label htmlFor={`birth-${i}`} style={{ fontSize: 13, color: '#111', marginBottom: 2 }}>Fecha de nacimiento</label>
              <input
                id={`birth-${i}`}
                type="date"
                value={guest.birth}
                onChange={e => handleChange(i, 'birth', e.target.value)}
                style={{ borderRadius: 6, border: errors[i]?.birth ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, fontSize: 15 }}
                aria-label="Fecha de nacimiento"
                required
              />
            </div>
            <span style={{ fontSize: 14, color: '#2563EB', minWidth: 60 }}>
              {guest.age !== null && !isNaN(guest.age) && guest.age >= 0 ? `${guest.age} años` : ''}
            </span>
            {guest.age !== null && guest.age < 18 && guest.age >= 0 && (
              <span style={{ fontSize: 12, color: '#fff', background: '#2563EB', borderRadius: 6, padding: '2px 8px', marginLeft: 4 }}>Menor de 18</span>
            )}
          </div>
          {touched[i]?.name && errors[i]?.name && (
            <div style={{ color: '#DC2626', fontSize: 13 }}>{errors[i].name}</div>
          )}
          {touched[i]?.birth && errors[i]?.birth && (
            <div style={{ color: '#DC2626', fontSize: 13 }}>{errors[i].birth}</div>
          )}
        </div>
      ))}
      {/* Resumen antes de confirmar */}
      {allValid && (
        <div style={{ background: '#e0f2fe', borderRadius: 8, padding: 12, marginBottom: 4, color: '#0369a1', fontSize: 15 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Resumen de reserva:</div>
          <div>Hotel: <b>{room.hotel}</b></div>
          <div>Habitación: <b>{room.type}</b></div>
          <div>Check-in: <b>{room.checkin}</b> | Check-out: <b>{room.checkout}</b></div>
          <div>Huéspedes: <b>{guests.map((g, i) => g.name + ' (' + (room.guestsCount && i < room.guestsCount.adults ? 'Adulto' : (room.guestsCount && i < room.guestsCount.adults + room.guestsCount.children ? 'Niño' : 'Bebé')) + ')').join(', ')}</b></div>
        </div>
      )}
      {submitError && <div style={{ color: '#DC2626', fontWeight: 500 }}>{submitError}</div>}
      <button type="submit" disabled={loading || !allValid} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 17, marginTop: 8, opacity: loading || !allValid ? 0.7 : 1 }}>{loading ? 'Confirmando...' : 'Confirmar reserva'}</button>
    </form>
  );
}
