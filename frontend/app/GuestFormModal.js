import React, { useState } from "react";

export default function GuestFormModal({ hotel, room, checkin, checkout, onClose }) {
  const [guests, setGuests] = useState([
    { name: "", birth: "" }
  ]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Validación simple
  const validate = () => {
    const errs = [];
    guests.forEach((g, i) => {
      if (!g.name.trim()) errs.push(`Nombre del huésped ${i+1} es obligatorio.`);
      else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$/.test(g.name)) errs.push(`Nombre del huésped ${i+1} solo admite letras y espacios.`);
      if (!g.birth) errs.push(`Fecha de nacimiento del huésped ${i+1} es obligatoria.`);
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(g.birth)) errs.push(`Fecha de nacimiento del huésped ${i+1} debe ser seleccionada.`);
    });
    if (!guests.some(g => {
      if (!g.birth) return false;
      const birth = new Date(g.birth);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear() - ((today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) ? 1 : 0);
      return age >= 18;
    })) errs.push("Debe haber al menos un adulto en la reserva.");
    return errs;
  };

  const handleChange = (idx, field, value) => {
    setGuests(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const handleAddGuest = () => {
    setGuests(prev => [...prev, { name: "", birth: "" }]);
  };
  const handleRemoveGuest = (idx) => {
    setGuests(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setLoading(true);
    setConfirmation(null);
    try {
      const res = await fetch("http://localhost:5000/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel: hotel.hotel || hotel.name,
          room_type: room.type,
          checkin,
          checkout,
          guests: guests.map(g => ({ name: g.name, birth: g.birth }))
        })
      });
      const data = await res.json();
      if (!res.ok) setErrors(data.errors || [data.message || "Error de reserva"]);
      else setConfirmation(data);
    } catch (err) {
      setErrors(["Error de conexión con el backend"]);
    }
    setLoading(false);
  };

  if (confirmation) {
    return (
      <div>
        <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 12 }}>Reserva confirmada</div>
        <div><b>Código de confirmación:</b> {confirmation.confirmation_code}</div>
        <div><b>Hotel:</b> {confirmation.hotel}</div>
        <div><b>Habitación:</b> {confirmation.room_type}</div>
        <div><b>Check-in:</b> {confirmation.checkin}</div>
        <div><b>Check-out:</b> {confirmation.checkout}</div>
        <div><b>Huéspedes:</b> {confirmation.guests.map((g, i) => (<div key={i}>{g.name} ({g.birth})</div>))}</div>
        <div><b>Total:</b> ${confirmation.total}</div>
        {confirmation.offer && <div><b>Oferta aplicada:</b> {confirmation.offer}</div>}
        <button onClick={onClose} style={{ marginTop: 18, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 500, fontSize: 17, marginBottom: 10 }}>Datos de los huéspedes</div>
      {guests.map((g, i) => (
        <div key={i} style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Nombre completo"
            value={g.name}
            onChange={e => handleChange(i, "name", e.target.value)}
            style={{ borderRadius: 8, border: '1px solid #ccc', padding: 8, width: 180 }}
            required
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 13, marginBottom: 2 }}>Fecha de nacimiento</label>
            <input
              type="date"
              value={g.birth}
              onChange={e => handleChange(i, "birth", e.target.value)}
              style={{ borderRadius: 8, border: '1px solid #ccc', padding: 8, width: 140 }}
              required
            />
          </div>
          {guests.length > 1 && <button type="button" onClick={() => handleRemoveGuest(i)} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>}
        </div>
      ))}
      <button type="button" onClick={handleAddGuest} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>Agregar huésped</button>
      {errors.length > 0 && <div style={{ color: '#DC2626', marginBottom: 10 }}>{errors.map((e, i) => (<div key={i}>{e}</div>))}</div>}
      <button type="submit" disabled={loading} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>{loading ? "Confirmando..." : "Confirmar reserva"}</button>
      <button type="button" onClick={onClose} style={{ marginLeft: 10, background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>Cancelar</button>
    </form>
  );
}
