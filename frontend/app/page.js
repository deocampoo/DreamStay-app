"use client";
import React, { useState, useEffect, useMemo } from "react";
import GuestFormModal from "./GuestFormModal";
import ReceptionPanel from "./ReceptionPanel";

const CITIES = ["Buenos Aires", "Mar del Plata"];

const ROOM_TYPES = [
  { value: "Single", label: "Single" },
  { value: "Doble", label: "Doble" },
  { value: "Suite", label: "Suite" },
  { value: "Todos", label: "Todas" },
];

const CAPACITY = {
  Single: { adults: 1, children: 0, babies: 0 },
  Doble: { adults: 2, children: 1, babies: 0 },
  Suite: { adults: 3, children: 2, babies: 1 },
};

const INITIAL_FILTERS = { offerOnly: false, maxPrice: "" };

function parseISO(dateStr) {
  if (!dateStr) return null;
  const isoParts = dateStr.split("-");
  if (isoParts.length === 3) {
    const [year, month, day] = isoParts.map((part) => parseInt(part, 10));
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  const slashParts = dateStr.split("/");
  if (slashParts.length === 3) {
    const [a, b, c] = slashParts.map((part) => parseInt(part, 10));
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      if (c > 31) {
        return new Date(c, a - 1, b);
      }
      if (a > 31) {
        return new Date(a, b - 1, c);
      }
      return new Date(c, b - 1, a);
    }
  }
  return null;
}

function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

function calculateNights(checkin, checkout) {
  const start = parseISO(checkin);
  const end = parseISO(checkout);
  if (!start || !end) return 1;
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

function validateForm(form) {
  const errors = {};
  if (!form.city.trim()) {
    errors.city = "La ciudad es obligatoria.";
  } else if (!/^[A-Za-z0-9 ]+$/.test(form.city)) {
    errors.city = "La ciudad solo admite caracteres alfanumericos y espacios.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkinDate = parseISO(form.checkin);
  const checkoutDate = parseISO(form.checkout);
  if (!checkinDate) {
    errors.checkin = "La fecha de entrada es obligatoria.";
  } else if (checkinDate < today) {
    errors.checkin = "La fecha de entrada no puede ser menor a la actual.";
  }
  if (!checkoutDate) {
    errors.checkout = "La fecha de salida es obligatoria.";
  } else if (checkinDate && checkoutDate <= checkinDate) {
    errors.checkout = "La fecha de salida debe ser posterior a la de entrada.";
  }
  if (!form.room_type) {
    errors.room_type = "El tipo de habitación es obligatorio.";
  }
  if (form.adults < 1) {
    errors.adults = "Debe haber al menos un adulto en la reserva.";
  }
  if (form.children < 0) {
    errors.children = "No se permiten valores negativos.";
  }
  if (form.babies < 0) {
    errors.babies = "No se permiten valores negativos.";
  }
  if (form.room_type !== "Todos") {
    const cap = CAPACITY[form.room_type];
    if (cap) {
      if (form.adults > cap.adults || form.children > cap.children || form.babies > cap.babies) {
        errors.capacity = "La cantidad de huéspedes excede la capacidad de la habitación seleccionada.";
      }
    }
  }
  return errors;
}

export default function Home() {
  const [form, setForm] = useState({
    city: "",
    checkin: "",
    checkout: "",
    room_type: "Single",
    adults: 1,
    children: 0,
    babies: 0,
  });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomsHotelName, setRoomsHotelName] = useState("");

  const [citySuggestions, setCitySuggestions] = useState([]);

  const handleCityChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, city: value }));
    setTouched((prev) => ({ ...prev, city: true }));
    if (value.length > 0) {
      setCitySuggestions(CITIES.filter((c) => c.toLowerCase().includes(value.toLowerCase())));
    } else {
      setCitySuggestions([]);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleIntChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: Math.max(0, parseInt(value, 10) || 0) }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  useEffect(() => {
    setErrors(validateForm(form));
  }, [form]);

  const nights = useMemo(() => calculateNights(form.checkin, form.checkout), [form.checkin, form.checkout]);

  const handleSearch = async (event) => {
    event.preventDefault();
    setTouched({ city: true, checkin: true, checkout: true, room_type: true, adults: true, children: true, babies: true });
    const currentErrors = validateForm(form);
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) {
      return;
    }
    setLoading(true);
    setApiError("");
    setResults(null);
    setFilters(INITIAL_FILTERS);
    setFilterTouched(false);
    try {
      const params = new URLSearchParams({
        city: form.city,
        from: form.checkin,
        to: form.checkout,
        roomType: form.room_type,
        adults: form.adults,
        children: form.children,
        babies: form.babies,
      });
      const response = await fetch(`http://localhost:5000/api/hotels/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setApiError(data.errors ? data.errors.join(". ") : data.message || "Error de búsqueda");
        setResults([]);
      } else {
        setResults(data);
      }
    } catch (error) {
      setApiError("Error de conexión con el backend");
      setResults([]);
    }
    setLoading(false);
  };

  const filteredResults = useMemo(() => {
    if (!Array.isArray(results)) return results;
    return results
      .map((hotel) => {
        let rooms = hotel.rooms || [];
        if (filters.offerOnly) {
          rooms = rooms.filter((room) => Boolean(room.offer));
        }
        if (filters.maxPrice) {
          const max = parseFloat(filters.maxPrice);
          if (!Number.isNaN(max)) {
            rooms = rooms.filter((room) => room.price_per_night <= max);
          }
        }
        return { ...hotel, rooms };
      })
      .filter((hotel) => hotel.rooms.length > 0);
  }, [results, filters]);

  const showFilteredNoResults = Array.isArray(filteredResults) && filteredResults.length === 0 && !loading && !apiError;

  const [filterTouched, setFilterTouched] = useState(false);
  const handleOfferToggle = (event) => {
    const { checked } = event.target;
    setFilters((prev) => ({ ...prev, offerOnly: checked }));
    setFilterTouched(true);
  };
  const handleMaxPriceChange = (event) => {
    setFilters((prev) => ({ ...prev, maxPrice: event.target.value }));
    setFilterTouched(true);
  };

  return (
    <div style={{ maxWidth: 1180, margin: "2rem auto", padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#fff', minHeight: '100vh', color: '#111' }}>
      <nav style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }} aria-label="breadcrumb">
        Home &gt; Search results
      </nav>
      <h1 style={{ fontWeight: 600, fontSize: 28, marginBottom: 24, color: '#111' }}>Búsqueda de hoteles</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(280px, 1fr)', gap: 24, alignItems: 'start', marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <form
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px 20px",
          background: "#f8fafc",
          borderRadius: 20,
          border: "1px solid #e2e8f0",
          padding: 24,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)"
        }}
        autoComplete="off"
        onSubmit={handleSearch}
        aria-label="Hotel search form"
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="city" style={{ fontWeight: 500 }}>Destino</label>
          <input
            id="city"
            name="city"
            type="text"
            value={form.city}
            onChange={handleCityChange}
            aria-label="Ciudad"
            aria-invalid={!!errors.city}
            aria-describedby="city-error"
            style={{ width: "100%", borderRadius: 8, border: errors.city ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, marginTop: 4, color: '#111', background: '#fff' }}
            autoComplete="off"
            list="city-list"
            required
          />
          <datalist id="city-list">
            {citySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {touched.city && errors.city && (
            <div id="city-error" style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.city}</div>
          )}
        </div>
        <div style={{ minWidth: 160 }}>
          <label htmlFor="checkin" style={{ fontWeight: 500 }}>Check-in</label>
          <input
            id="checkin"
            name="checkin"
            type="date"
            value={form.checkin}
            onChange={handleChange}
            aria-label="Fecha de entrada"
            aria-invalid={!!errors.checkin}
            aria-describedby="checkin-error"
            style={{ width: "100%", borderRadius: 8, border: errors.checkin ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, marginTop: 4, color: '#111', background: '#fff' }}
            required
          />
          {touched.checkin && errors.checkin && (
            <div id="checkin-error" style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.checkin}</div>
          )}
        </div>
        <div style={{ minWidth: 160 }}>
          <label htmlFor="checkout" style={{ fontWeight: 500 }}>Check-out</label>
          <input
            id="checkout"
            name="checkout"
            type="date"
            value={form.checkout}
            onChange={handleChange}
            aria-label="Fecha de salida"
            aria-invalid={!!errors.checkout}
            aria-describedby="checkout-error"
            style={{ width: "100%", borderRadius: 8, border: errors.checkout ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, marginTop: 4, color: '#111', background: '#fff' }}
            required
          />
          {touched.checkout && errors.checkout && (
            <div id="checkout-error" style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.checkout}</div>
          )}
        </div>
        <div style={{ minWidth: 150 }}>
          <label htmlFor="room_type" style={{ fontWeight: 500 }}>Tipo de habitación</label>
          <select
            id="room_type"
            name="room_type"
            value={form.room_type}
            onChange={handleChange}
            aria-label="Tipo de habitación"
            style={{ width: "100%", borderRadius: 8, border: errors.room_type ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, marginTop: 4, color: '#111', background: '#fff' }}
            required
          >
            {ROOM_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {touched.room_type && errors.room_type && (
            <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.room_type}</div>
          )}
        </div>
        <div style={{ minWidth: 180, display: 'flex', gap: 8, flexDirection: 'column' }}>
          <label style={{ fontWeight: 500 }}>Huéspedes</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <input
                name="adults"
                type="number"
                min={1}
                value={form.adults}
                onChange={handleIntChange}
                aria-label="Adultos"
                aria-invalid={!!errors.adults}
                style={{ width: 58, borderRadius: 8, border: errors.adults ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 4 }}>Adultos</span>
            </div>
            <div>
              <input
                name="children"
                type="number"
                min={0}
                value={form.children}
                onChange={handleIntChange}
                aria-label="Niños"
                aria-invalid={!!errors.children}
                style={{ width: 58, borderRadius: 8, border: errors.children ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 4 }}>Niños</span>
            </div>
            <div>
              <input
                name="babies"
                type="number"
                min={0}
                value={form.babies}
                onChange={handleIntChange}
                aria-label="Bebés"
                aria-invalid={!!errors.babies}
                style={{ width: 58, borderRadius: 8, border: errors.babies ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 4 }}>Bebés</span>
            </div>
          </div>
          {touched.adults && errors.adults && (
            <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.adults}</div>
          )}
          {touched.children && errors.children && (
            <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.children}</div>
          )}
          {touched.babies && errors.babies && (
            <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.babies}</div>
          )}
        </div>
        {errors.capacity && (
          <div style={{ color: "#DC2626", fontSize: 13, gridColumn: '1 / -1' }} aria-live="polite">{errors.capacity}</div>
        )}
        <button
          type="submit"
          style={{
            gridColumn: '1 / -1',
            justifySelf: 'flex-end',
            background: Object.keys(errors).length === 0 ? '#2563EB' : '#94a3b8',
            color: '#fff',
            fontWeight: 600,
            border: 'none',
            borderRadius: 999,
            padding: '12px 32px',
            fontSize: 16,
            cursor: Object.keys(errors).length === 0 ? 'pointer' : 'not-allowed',
            marginTop: 8,
            boxShadow: '0 12px 30px rgba(37, 99, 235, 0.25)',
            transition: 'background 0.2s, transform 0.2s',
          }}
          disabled={Object.keys(errors).length > 0}
          aria-disabled={Object.keys(errors).length > 0}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Buscar
        </button>
      </form>

      {Array.isArray(results) && results.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 16,
          marginBottom: 16,
          alignItems: 'center',
          background: '#f8fafc',
        }} aria-label="Filtros adicionales">
          <strong style={{ fontSize: 14 }}>Filtros</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={filters.offerOnly} onChange={handleOfferToggle} /> Solo habitaciones con oferta
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14 }}>
            <label htmlFor="filter-max-price">Precio máximo por noche</label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              value={filters.maxPrice}
              onChange={handleMaxPriceChange}
              placeholder="Ej: 300"
              style={{ width: 120, borderRadius: 8, border: '1px solid #cbd5f5', padding: 6, marginTop: 4 }}
            />
          </div>
          {filterTouched && showFilteredNoResults && (
            <span style={{ fontSize: 13, color: '#64748b' }}>No hay habitaciones que cumplan con los filtros actuales.</span>
          )}
        </div>
      )}

      {apiError && (
        <div style={{ color: '#DC2626', margin: '16px 0', fontWeight: 500 }} aria-live="polite">
          {apiError} <button onClick={() => setApiError("")} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #0001', padding: 20, minHeight: 220 }}>
              <div style={{ background: '#e5e7eb', height: 120, borderRadius: 12, marginBottom: 16 }} />
              <div style={{ background: '#e5e7eb', height: 20, width: '60%', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ background: '#e5e7eb', height: 16, width: '40%', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ background: '#e5e7eb', height: 16, width: '80%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      {Array.isArray(filteredResults) && filteredResults.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          {filteredResults.map((hotel, hotelIndex) => (
            <div key={`${hotel.hotel}-${hotelIndex}`} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #0001', padding: 20, display: 'flex', flexDirection: 'column', color: '#111' }}>
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#cbd5e1', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 24 }}>
                <span role="img" aria-label="Hotel">🏨</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 12 }}>{hotel.hotel}</div>
              {hotel.rooms.map((room, roomIndex) => (
                <div key={`${room.name}-${roomIndex}`} style={{ borderTop: roomIndex === 0 ? 'none' : '1px solid #e2e8f0', paddingTop: roomIndex === 0 ? 0 : 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{room.name}</div>
                  <div style={{ fontSize: 14, color: '#475569' }}>Tipo: {room.type}</div>
                  <div style={{ fontSize: 14, color: '#475569' }}>Capacidad: {room.capacity}</div>
                  <div style={{ fontSize: 14, color: '#047857', fontWeight: 600 }}>Estado: {room.state}</div>
                  <div style={{ fontSize: 14, marginTop: 6 }}>Precio por noche: <strong>{formatCurrency(room.price_per_night)}</strong></div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Total para {nights} noche{nights !== 1 ? 's' : ''}: {formatCurrency(room.price)}</div>
                  {room.offer && <div style={{ background: '#16A34A', color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 12, display: 'inline-block', marginTop: 6 }}>Oferta: {room.offer}</div>}
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                      onClick={() => {
                        setSelectedHotel(hotel);
                        setSelectedRoom({ ...room, price: room.price, price_per_night: room.price_per_night });
                        setModalOpen(true);
                      }}
                    >Reservar</button>
                    <button
                      style={{ background: '#fff', color: '#2563EB', border: '1.5px solid #2563EB', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                      onClick={() => {
                        setRoomsHotelName(hotel.hotel);
                        setRoomsModalOpen(true);
                      }}
                    >Ver</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showFilteredNoResults && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 48, fontSize: 20 }}>
          <span role="img" aria-label="Sin resultados" style={{ fontSize: 40 }}>🔍</span><br />
          No se encontraron habitaciones disponibles para los criterios seleccionados
        </div>
      )}

      {Array.isArray(results) && results.length === 0 && !apiError && !loading && !filterTouched && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 48, fontSize: 20 }}>
          <span role="img" aria-label="Sin resultados" style={{ fontSize: 40 }}>🔍</span><br />
          No se encontraron habitaciones disponibles para los criterios seleccionados
        </div>
      )}

        </div>
        <div style={{ position: 'sticky', top: 24 }}>
          <ReceptionPanel />
        </div>
      </div>

      {modalOpen && selectedHotel && selectedRoom && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, minWidth: 420, maxWidth: 600, boxShadow: '0 4px 24px #0002', position: 'relative' }}>
            <button onClick={() => setModalOpen(false)} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 26, color: '#64748b', cursor: 'pointer' }} aria-label="Cerrar">×</button>
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 18 }}>Reserva de habitación</div>
            <div style={{ marginBottom: 16 }}>
              <div><b>Hotel:</b> {selectedHotel.hotel}</div>
              <div><b>Habitación:</b> {selectedRoom.name || selectedRoom.type}</div>
              <div><b>Tipo:</b> {selectedRoom.type}</div>
              <div><b>Capacidad:</b> {selectedRoom.capacity}</div>
              <div><b>Precio por noche:</b> {formatCurrency(selectedRoom.price_per_night)}</div>
              <div><b>Total:</b> {formatCurrency(selectedRoom.price)}</div>
            </div>
            <GuestFormModal
              hotel={selectedHotel}
              room={selectedRoom}
              checkin={form.checkin}
              checkout={form.checkout}
              onClose={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}

      {roomsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, minWidth: 360, boxShadow: '0 4px 24px #0003', position: 'relative' }}>
            <button onClick={() => setRoomsModalOpen(false)} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="Cerrar">×</button>
            <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 12 }}>Habitaciones de {roomsHotelName}</div>
            <ul style={{ paddingLeft: 18, color: '#475569' }}>
              {Array.isArray(filteredResults) && filteredResults
                .find((hotel) => hotel.hotel === roomsHotelName)?.rooms
                .map((room) => (
                  <li key={`${room.name}-modal`}>{room.name} – {formatCurrency(room.price_per_night)} por noche</li>
                )) || <li>No hay información disponible.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
