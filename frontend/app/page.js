
"use client";
import { useState, useEffect } from "react";
import GuestForm from "./GuestForm";
import HotelRoomsList from "./HotelRoomsList";

// Modal simple reutilizable
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, minWidth: 420, maxWidth: 600, boxShadow: '0 4px 24px #0002', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 26, color: '#64748b', cursor: 'pointer' }} aria-label="Cerrar">×</button>
        {children}
      </div>
    </div>
  );
}

const CITIES = ["Buenos Aires", "Mar del Plata"];
const ROOM_TYPES = [
  { value: "Single", label: "Single" },
  { value: "Doble", label: "Doble" },
  { value: "Suite", label: "Suite" },
];
const CAPACITY = {
  Single: { adults: 1, children: 0, babies: 0 },
  Doble: { adults: 2, children: 1, babies: 0 },
  Suite: { adults: 3, children: 2, babies: 1 },
};

function validateForm(form) {
  const errors = {};
  // Ciudad
  if (!form.city.trim()) {
    errors.city = "La ciudad es obligatoria.";
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$/.test(form.city)) {
    errors.city = "La ciudad solo admite letras y espacios.";
  }
  // Fechas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkin = form.checkin ? new Date(form.checkin) : null;
  const checkout = form.checkout ? new Date(form.checkout) : null;
  if (!checkin) {
    errors.checkin = "La fecha de entrada es obligatoria.";
  } else if (checkin < today) {
    errors.checkin = "La fecha de entrada no puede ser menor a la actual.";
  }
  if (!checkout) {
    errors.checkout = "La fecha de salida es obligatoria.";
  } else if (checkin && checkout <= checkin) {
    errors.checkout = "La fecha de salida debe ser posterior a la de entrada.";
  }
  // Tipo de habitación
  if (!form.room_type) {
    errors.room_type = "El tipo de habitación es obligatorio.";
  }
  // Huéspedes
  if (form.adults < 1) {
    errors.adults = "Debe haber al menos un adulto en la reserva.";
  }
  if (form.children < 0) {
    errors.children = "No se permiten valores negativos.";
  }
  if (form.babies < 0) {
    errors.babies = "No se permiten valores negativos.";
  }
  // Capacidad
  const cap = CAPACITY[form.room_type] || CAPACITY.Single;
  if (
    form.adults > cap.adults ||
    form.children > cap.children ||
    form.babies > cap.babies
  ) {
    errors.capacity = "La cantidad de huéspedes excede la capacidad de la habitación seleccionada.";
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

  // Autocomplete ciudades
  const [citySuggestions, setCitySuggestions] = useState([]);
  const handleCityChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, city: value }));
    setTouched((prev) => ({ ...prev, city: true }));
    if (value.length > 0) {
      setCitySuggestions(CITIES.filter((c) => c.toLowerCase().includes(value.toLowerCase())));
    } else {
      setCitySuggestions([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };
  const handleIntChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: Math.max(0, parseInt(value) || 0) }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Validación en tiempo real
  useEffect(() => {
    setErrors(validateForm(form));
  }, [form]);

  // Estado de resultados
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // Modal de reserva
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  // Modal de habitaciones
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomsHotelName, setRoomsHotelName] = useState("");

  // Convierte yyyy-mm-dd a dd/mm/yyyy
  const toDDMMYYYY = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };
  // Convierte a ISO yyyy-mm-dd
  const toISO = (dateStr) => dateStr;

  // Enviar búsqueda
  const handleSearch = async (e) => {
    e.preventDefault();
    setTouched({ city: true, checkin: true, checkout: true, room_type: true, adults: true, children: true, babies: true });
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setApiError("");
    setResults(null);
    try {
      const params = new URLSearchParams({
        city: form.city,
        from: toISO(form.checkin),
        to: toISO(form.checkout),
        roomType: form.room_type,
        adults: form.adults,
        children: form.children,
        babies: form.babies,
      });
      // Cambia la URL a tu endpoint real si es necesario
      const res = await fetch(`http://localhost:5000/api/hotels/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.errors ? data.errors.join(". ") : data.message || "Error de búsqueda");
        setResults([]);
      } else {
        setResults(data);
      }
    } catch (err) {
      setApiError("Error de conexión con el backend");
      setResults([]);
    }
    setLoading(false);
  };

  // Layout y barra de búsqueda + resultados
  return (
  <div style={{ maxWidth: 900, margin: "2rem auto", padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#fff', minHeight: '100vh', color: '#111' }}>
      <nav style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }} aria-label="breadcrumb">
        Home &gt; Search results
      </nav>
  <h1 style={{ fontWeight: 600, fontSize: 28, marginBottom: 24, color: '#111' }}>Búsqueda de hoteles</h1>
      <form
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "none",
          border: '2px solid #111',
          padding: 24,
          alignItems: "end",
          marginBottom: 32,
        }}
        autoComplete="off"
        onSubmit={handleSearch}
        aria-label="Hotel search form"
      >
        {/* Ciudad */}
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
        {/* Check-in */}
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
        {/* Check-out */}
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
        {/* Room type */}
        <div style={{ minWidth: 120 }}>
          <label htmlFor="room_type" style={{ fontWeight: 500 }}>Tipo de habitación</label>
          <select
            id="room_type"
            name="room_type"
            value={form.room_type}
            onChange={handleChange}
            aria-label="Tipo de habitación"
            aria-invalid={!!errors.room_type}
            aria-describedby="roomtype-error"
            style={{ width: "100%", borderRadius: 8, border: errors.room_type ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, marginTop: 4, color: '#111', background: '#fff' }}
            required
          >
            {ROOM_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
          {touched.room_type && errors.room_type && (
            <div id="roomtype-error" style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">{errors.room_type}</div>
          )}
        </div>
        {/* Guests */}
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
                style={{ width: 48, borderRadius: 8, border: errors.adults ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 2 }}>Adultos</span>
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
                style={{ width: 48, borderRadius: 8, border: errors.children ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 2 }}>Niños</span>
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
                style={{ width: 48, borderRadius: 8, border: errors.babies ? '2px solid #DC2626' : '1px solid #ccc', padding: 8, color: '#111', background: '#fff' }}
                required
              />
              <span style={{ fontSize: 13, marginLeft: 2 }}>Bebés</span>
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
        {/* Capacidad */}
        {errors.capacity && (
          <div style={{ color: "#DC2626", fontSize: 13, flexBasis: '100%' }} aria-live="polite">{errors.capacity}</div>
        )}
        <button
          type="submit"
          style={{
            background: Object.keys(errors).length === 0 ? '#2563EB' : '#94a3b8',
            color: '#fff',
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontSize: 16,
            cursor: Object.keys(errors).length === 0 ? 'pointer' : 'not-allowed',
            marginLeft: 'auto',
            marginTop: 8,
            boxShadow: '0 1px 4px #0001',
            transition: 'background 0.2s',
          }}
          disabled={Object.keys(errors).length > 0}
          aria-disabled={Object.keys(errors).length > 0}
        >
          Buscar
        </button>
      </form>

      {/* Estados de error de red/servidor */}
      {apiError && (
        <div style={{ color: '#DC2626', margin: '16px 0', fontWeight: 500 }} aria-live="polite">
          {apiError} <button onClick={() => setApiError("")} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}

      {/* Loading skeletons */}
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

      {/* Resultados */}
      {results && Array.isArray(results) && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          {results.map((hotel, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #0001', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 220, color: '#111' }}>
              {/* Imagen simulada */}
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#cbd5e1', borderRadius: 12, marginBottom: 16, objectFit: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 24 }}>
                <span role="img" aria-label="Hotel">🏨</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 4, color: '#111' }}>{hotel.hotel}</div>
              {hotel.rooms && hotel.rooms.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {hotel.rooms.map((room, j) => (
                    <span key={j} style={{ display: 'inline-block', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '2px 10px', fontSize: 13, marginRight: 6, marginBottom: 2 }}>
                      {room.type}
                    </span>
                  ))}
                </div>
              )}
              {hotel.rooms && hotel.rooms.length > 0 && hotel.rooms.map((room, j) => (
                <div key={j} style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 500, color: '#111' }}>Precio total: </span>${room.price} <span style={{ color: '#64748b', fontSize: 13 }}>/ {room.type}</span><br />
                  <span style={{ fontWeight: 500, color: '#111' }}>Precio por noche: </span>${room.price_per_night.toFixed(2)}<br />
                  {room.offer && <span style={{ background: '#16A34A', color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 12, marginLeft: 4 }}>Oferta: {room.offer}</span>}
                </div>
              ))}
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                <button
                  style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                  onClick={() => {
                    setSelectedRoom(hotel.rooms[0]);
                    setSelectedHotel(hotel);
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
      {/* Modal de listado de habitaciones */}
      <HotelRoomsList
        hotelName={roomsHotelName}
        checkin={form.checkin}
        checkout={form.checkout}
        open={roomsModalOpen}
        onClose={() => setRoomsModalOpen(false)}
      />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal de reserva de huéspedes */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 16 }}>Reserva de habitación</div>
        {selectedHotel && selectedRoom && (
          <div style={{ marginBottom: 16 }}>
            <div><b>Hotel:</b> {selectedHotel.hotel}</div>
            <div><b>Habitación:</b> {selectedRoom.type}</div>
            <div><b>Precio total:</b> ${selectedRoom.price}</div>
            <div><b>Precio por noche:</b> ${selectedRoom.price_per_night.toFixed(2)}</div>
          </div>
        )}
        <GuestForm 
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          room={{
            ...selectedRoom,
            hotel: selectedHotel?.hotel || selectedHotel?.name,
            checkin: form.checkin,
            checkout: form.checkout,
            guestsCount: {
              adults: form.adults,
              children: form.children,
              babies: form.babies
            }
          }}
        />
      </Modal>







      {/* Sin resultados */}
      {results && Array.isArray(results) && results.length === 0 && !apiError && !loading && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 48, fontSize: 20 }}>
          <span role="img" aria-label="Sin resultados" style={{ fontSize: 40 }}>😕</span><br />
          No se encontraron hoteles disponibles con los criterios seleccionados
        </div>
      )}
    </div>
  );
}
