"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import GuestFormModal from "./GuestFormModal";
import ReceptionPanel from "./ReceptionPanel";
import ReservationSummaryCard from "./ReservationSummaryCard";
import PaymentModal from "./PaymentModal";

const CITIES = ["Buenos Aires", "Mar del Plata"];

const CITY_REGEX = /^[\p{L}0-9 ]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROOM_TYPES = [
  { value: "Single", label: "Single" },
  { value: "Doble", label: "Doble" },
  { value: "Suite", label: "Suite" },
  { value: "Todos", label: "Todas" },
];

const HOTEL_ICON = String.fromCodePoint(0x1f3e8);
const SEARCH_ICON = String.fromCodePoint(0x1f50d);

const CAPACITY = {
  Single: { adults: 1, children: 0, babies: 0 },
  Doble: { adults: 2, children: 1, babies: 0 },
  Suite: { adults: 3, children: 2, babies: 1 },
};


const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

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

function formatCapacityLabel(capacity) {
  if (!capacity) return "";
  const parts = [];
  if (capacity.adults) {
    parts.push(`${capacity.adults} adulto${capacity.adults !== 1 ? 's' : ''}`);
  }
  if (capacity.children) {
    parts.push(`${capacity.children} niño${capacity.children !== 1 ? 's' : ''}`);
  }
  if (capacity.babies) {
    parts.push(`${capacity.babies} bebé${capacity.babies !== 1 ? 's' : ''}`);
  }
  return parts.join(' + ');
}

function priceDetailsEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const normalize = (value) => Number(value ?? 0).toFixed(2);
  const compareKeys = (objA = {}, objB = {}, keys = []) =>
    keys.every((key) => normalize(objA[key]) === normalize(objB[key]));
  const sameCounts = compareKeys(a.counts, b.counts, ["adult", "child", "baby"]);
  const sameRates = compareKeys(a.per_night, b.per_night, ["adult", "child", "baby"]);
  return (
    sameCounts &&
    sameRates &&
    normalize(a.subtotal_per_night) === normalize(b.subtotal_per_night) &&
    normalize(a.total) === normalize(b.total) &&
    normalize(a.nights) === normalize(b.nights)
  );
}

function validateForm(form) {
  const errors = {};
  if (!form.city.trim()) {
    errors.city = "La ciudad es obligatoria.";
  } else if (!CITY_REGEX.test(form.city)) {
    errors.city = "La ciudad solo admite letras, números y espacios.";
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
  const [confirmedReservation, setConfirmedReservation] = useState(null);
  const [pricePreviewDetail, setPricePreviewDetail] = useState(null);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomsHotelName, setRoomsHotelName] = useState("");

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  const [lookupForm, setLookupForm] = useState({ code: "", email: "" });
  const [lookupErrors, setLookupErrors] = useState({});
  const [lookupFeedback, setLookupFeedback] = useState({ type: "", text: "" });
  const [lookupLoading, setLookupLoading] = useState(false);
  const summaryRef = useRef(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentReservation, setPaymentReservation] = useState(null);

  useEffect(() => {
    if (activeReservation && summaryRef.current) {
      try {
        summaryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        // scrollIntoView no disponible (SSR) - ignorar
      }
    }
  }, [activeReservation]);

  const adjustRoomPrices = useCallback(
    (detail, persistBase = false) => {
      if (!selectedHotel || !selectedRoom) return;

      const applyToList = (list) => {
        if (!Array.isArray(list)) return list;
        return list.map((hotel) => {
          if (hotel.hotel !== selectedHotel.hotel) return hotel;
          return {
            ...hotel,
            rooms: hotel.rooms.map((roomItem) => {
              if (roomItem.name !== selectedRoom.name || roomItem.type !== selectedRoom.type) {
                return roomItem;
              }
              const basePerNight = roomItem.base_price_per_night ?? roomItem.price_per_night;
              const baseTotal = roomItem.base_price_total ?? roomItem.price;
              const baseDetail = roomItem.base_price_detail ?? roomItem.price_detail ?? null;

              if (!detail) {
                if (
                  roomItem.price_per_night === basePerNight &&
                  roomItem.price === baseTotal &&
                  priceDetailsEqual(roomItem.price_detail, baseDetail)
                ) {
                  return roomItem;
                }
                return {
                  ...roomItem,
                  price_per_night: basePerNight,
                  price: baseTotal,
                  price_detail: baseDetail,
                };
              }

              if (priceDetailsEqual(roomItem.price_detail, detail)) {
                return roomItem;
              }

              const updatedRoom = {
                ...roomItem,
                price_per_night: detail.subtotal_per_night,
                price: detail.total,
                price_detail: detail,
              };

              if (persistBase) {
                updatedRoom.base_price_per_night = detail.subtotal_per_night;
                updatedRoom.base_price_total = detail.total;
                updatedRoom.base_price_detail = detail;
              }

              return updatedRoom;
            }),
          };
        });
      };

      setResults((prev) => applyToList(prev));
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const basePerNight = prev.base_price_per_night ?? prev.price_per_night;
        const baseTotal = prev.base_price_total ?? prev.price;
        const baseDetail = prev.base_price_detail ?? prev.price_detail ?? null;
        if (!detail) {
          if (
            prev.price_per_night === basePerNight &&
            prev.price === baseTotal &&
            priceDetailsEqual(prev.price_detail, baseDetail)
          ) {
            return prev;
          }
          return {
            ...prev,
            price_per_night: basePerNight,
            price: baseTotal,
            price_detail: baseDetail,
          };
        }
        if (priceDetailsEqual(prev.price_detail, detail)) {
          return prev;
        }
        const next = {
          ...prev,
          price_per_night: detail.subtotal_per_night,
          price: detail.total,
          price_detail: detail,
        };
        if (persistBase) {
          next.base_price_per_night = detail.subtotal_per_night;
          next.base_price_total = detail.total;
          next.base_price_detail = detail;
        }
        return next;
      });
    },
    [selectedHotel, selectedRoom]
  );

  const handlePricePreview = useCallback(
    (detail) => {
      setPricePreviewDetail((prev) => {
        if (priceDetailsEqual(prev, detail)) {
          return prev;
        }
        return detail || null;
      });
      adjustRoomPrices(detail, false);
    },
    [adjustRoomPrices]
  );

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

  const handleCloseModal = () => {
    handlePricePreview(null);
    setModalOpen(false);
    setConfirmedReservation(null);
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

  const modalPriceDetail = confirmedReservation?.price_detail || pricePreviewDetail || selectedRoom?.price_detail;
  const modalPricePerNight = modalPriceDetail?.subtotal_per_night ?? selectedRoom?.price_per_night ?? null;
  const modalTotalPrice = modalPriceDetail?.total ?? selectedRoom?.price ?? null;

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
      const tzOffset = new Date().getTimezoneOffset();
      const params = new URLSearchParams({
        city: form.city,
        from: form.checkin,
        to: form.checkout,
        roomType: form.room_type,
        adults: form.adults,
        children: form.children,
        babies: form.babies,
        tzOffset: tzOffset,
      });
      const response = await fetch(`${API_BASE_URL}/api/hotels/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        const message = Array.isArray(data?.errors) ? data.errors.join(". ") : data?.message || "Error de búsqueda";
        setApiError(message);
        setResults([]);
      } else if (Array.isArray(data)) {
        const normalized = data.map((hotel) => ({
          ...hotel,
          rooms: Array.isArray(hotel.rooms)
            ? hotel.rooms.map((room) => {
                const capacityLabel = room.capacity || formatCapacityLabel(room.capacity_breakdown);
                return {
                  ...room,
                  capacity: capacityLabel,
                  capacity_breakdown: room.capacity_breakdown || null,
                  base_price_per_night: room.price_per_night,
                  base_price_total: room.price,
                  base_price_detail: room.price_detail || null,
                };
              })
            : [],
        }));
        setResults(normalized);
      } else if (Array.isArray(data?.results)) {
        const normalized = data.results.map((hotel) => ({
          ...hotel,
          rooms: Array.isArray(hotel.rooms)
            ? hotel.rooms.map((room) => {
                const capacityLabel = room.capacity || formatCapacityLabel(room.capacity_breakdown);
                return {
                  ...room,
                  capacity: capacityLabel,
                  capacity_breakdown: room.capacity_breakdown || null,
                };
              })
            : [],
        }));
        setResults(normalized);
      } else {
        setResults([]);
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

  const handleLookupChange = (field) => (event) => {
    const value = field === "code" ? event.target.value.toUpperCase() : event.target.value;
    setLookupForm((prev) => ({ ...prev, [field]: value }));
    setLookupErrors((prev) => ({ ...prev, [field]: "" }));
    setLookupFeedback({ type: "", text: "" });
  };

  const persistActiveReservation = useCallback((reservation, feedbackMessage = "") => {
    if (!reservation) return;
    setActiveReservation(reservation);
    setLookupForm((prev) => ({
      code: reservation.confirmation_code || prev.code,
      email: reservation.contact_email || reservation.email || prev.email,
    }));
    if (feedbackMessage) {
      setLookupFeedback({ type: "success", text: feedbackMessage });
    }
  }, []);

  const validateLookupForm = useCallback(() => {
    const validation = {};
    if (!lookupForm.code.trim()) {
      validation.code = "El código es obligatorio.";
    }
    const trimmedEmail = lookupForm.email.trim();
    if (!trimmedEmail) {
      validation.email = "El correo es obligatorio.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      validation.email = "Ingresa un correo válido.";
    }
    return validation;
  }, [lookupForm]);

  const handleReservationLookup = async (event) => {
    event.preventDefault();
    const validation = validateLookupForm();
    setLookupErrors(validation);
    if (Object.keys(validation).length > 0) {
      setLookupFeedback({ type: "error", text: "Completa los datos para buscar tu reserva." });
      return;
    }
    setLookupLoading(true);
    setLookupFeedback({ type: "", text: "" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: lookupForm.code.trim().toUpperCase(),
          email: lookupForm.email.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActiveReservation(null);
        setLookupFeedback({
          type: "error",
          text: data.error || "No se encontr\u00F3 una reserva asociada a los datos ingresados.",
        });
      } else {
        const reservationPayload = data.reservation || data;
        persistActiveReservation(
          reservationPayload,
          "Reserva encontrada. Revisa el resumen a continuacion."
        );
      }
    } catch (error) {
      setActiveReservation(null);
      setLookupFeedback({ type: "error", text: "Error de conexion con el backend." });
    }
    setLookupLoading(false);
  };

  const handleInfoAction = useCallback((actionKey) => {
    const actionMessages = {
      modify: "La modificacion de reserva estara habilitada pronto.",
      cancel: "La cancelacion online estara disponible en la HU correspondiente.",
      checkout: "El check-out desde la app estara disponible para ocupaciones altas.",
    };
    setLookupFeedback({
      type: "info",
      text: actionMessages[actionKey] || "Esta accion estara disponible proximamente.",
    });
  }, []);

  const handlePayRequest = useCallback(
    (reservation) => {
      if (!reservation) return;
      setPaymentReservation(reservation);
      setPaymentModalOpen(true);
      setLookupFeedback({ type: "", text: "" });
    },
    []
  );

  const handlePaymentSuccess = useCallback(
    (data) => {
      if (data?.reservation) {
        persistActiveReservation(
          data.reservation,
          "Pago realizado con exito. Tu reserva quedo confirmada."
        );
        setPaymentReservation(data.reservation);
      }
    },
    [persistActiveReservation]
  );

  const reservationActions = useMemo(
    () => ({
      pay: handlePayRequest,
      modify: () => handleInfoAction("modify"),
      cancel: () => handleInfoAction("cancel"),
      checkout: () => handleInfoAction("checkout"),
    }),
    [handlePayRequest, handleInfoAction]
  );

  return (
    <div className="app-shell">
      <nav style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }} aria-label="breadcrumb">
        Home &gt; Search results
      </nav>
      <h1 style={{ fontWeight: 600, fontSize: 28, marginBottom: 24, color: '#111' }}>Búsqueda de hoteles</h1>
      <div className="search-layout">
        <div className="search-main">
          <form
            className="search-form"
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
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Buscar
            </button>
          </form>

          <section
            aria-label="Buscar reserva existente"
            style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#0f172a" }}>¿Ya tenés una reserva?</h2>
            <p style={{ marginTop: 6, fontSize: 14, color: "#475569" }}>
              Ingresá tu código y correo para recuperar el resumen sin salir de esta pantalla.
            </p>
            <form onSubmit={handleReservationLookup} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                  <label htmlFor="lookup-code" style={{ fontWeight: 500, fontSize: 14 }}>Código de reserva</label>
                  <input
                    id="lookup-code"
                    type="text"
                    value={lookupForm.code}
                    onChange={handleLookupChange("code")}
                    placeholder="ABC12345"
                    style={{ width: "100%", borderRadius: 8, border: lookupErrors.code ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10, marginTop: 4 }}
                    aria-invalid={!!lookupErrors.code}
                  />
                  {lookupErrors.code && (
                    <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">
                      {lookupErrors.code}
                    </div>
                  )}
                </div>
                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <label htmlFor="lookup-email" style={{ fontWeight: 500, fontSize: 14 }}>Correo</label>
                  <input
                    id="lookup-email"
                    type="email"
                    value={lookupForm.email}
                    onChange={handleLookupChange("email")}
                    placeholder="correo@dominio.com"
                    style={{ width: "100%", borderRadius: 8, border: lookupErrors.email ? "2px solid #DC2626" : "1px solid #cbd5f5", padding: 10, marginTop: 4 }}
                    aria-invalid={!!lookupErrors.email}
                  />
                  {lookupErrors.email && (
                    <div style={{ color: "#DC2626", fontSize: 13 }} aria-live="polite">
                      {lookupErrors.email}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  style={{
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 28px",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: lookupLoading ? "wait" : "pointer",
                    minWidth: 200,
                  }}
                >
                  {lookupLoading ? "Buscando..." : "Buscar Reserva"}
                </button>
              </div>
            </form>
            {lookupFeedback.text && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "center",
                  color:
                    lookupFeedback.type === "error"
                      ? "#DC2626"
                      : lookupFeedback.type === "success"
                      ? "#16A34A"
                      : "#0EA5E9",
                }}
              >
                {lookupFeedback.text}
              </div>
            )}
          </section>

          {activeReservation && (
            <div ref={summaryRef}>
              <ReservationSummaryCard
                reservation={activeReservation}
                onAction={reservationActions}
                currencyFormatter={formatCurrency}
              />
            </div>
          )}

          {Array.isArray(results) && results.length > 0 && (
            <div
              className="filters-bar"
              aria-label="Filtros adicionales"
            >
              <strong style={{ fontSize: 14 }}>Filtros</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="checkbox" checked={filters.offerOnly} onChange={handleOfferToggle} /> Solo habitaciones con oferta</label>
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14 }}><label htmlFor="filter-max-price">Precio máximo por noche</label><input id="filter-max-price" type="number" min={0} value={filters.maxPrice} onChange={handleMaxPriceChange} placeholder="Ej: 300" style={{ width: 120, borderRadius: 8, border: '1px solid #cbd5f5', padding: 6, marginTop: 4 }} /></div>
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
            <div className="results-grid" style={{ minHeight: 220 }}>
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
            <div className="results-grid">
              {filteredResults.map((hotel, hotelIndex) => (
                <div key={`${hotel.hotel}-${hotelIndex}`} className="hotel-card">
                  <div className="hotel-image">
                    <span role="img" aria-label="Hotel">{HOTEL_ICON}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 12 }}>{hotel.hotel}</div>
                  {Array.isArray(hotel.offers) && hotel.offers.length > 0 && (
                    <div style={{ fontSize: 13, color: '#047857', fontWeight: 500 }}>Ofertas: {hotel.offers.join(', ')}</div>
                  )}
                  {hotel.rooms.map((room, roomIndex) => (
                    <div key={`${room.name}-${roomIndex}`} className="room-card">
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
                            setSelectedRoom({
                              ...room,
                              price: room.price,
                              price_per_night: room.price_per_night,
                              base_price_per_night: room.base_price_per_night ?? room.price_per_night,
                              base_price_total: room.base_price_total ?? room.price,
                              base_price_detail: room.base_price_detail ?? room.price_detail ?? null,
                            });
                            setConfirmedReservation(null);
                            setPricePreviewDetail(null);
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
              <span role="img" aria-label="Sin resultados" style={{ fontSize: 40 }}>{SEARCH_ICON}</span><br />
              No se encontraron habitaciones disponibles para los criterios seleccionados
            </div>
          )}

          {Array.isArray(results) && results.length === 0 && !apiError && !loading && !filterTouched && (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: 48, fontSize: 20 }}>
              <span role="img" aria-label="Sin resultados" style={{ fontSize: 40 }}>{SEARCH_ICON}</span><br />
              No se encontraron habitaciones disponibles para los criterios seleccionados
            </div>
          )}
        </div>
        <aside className="search-sidebar">
          <ReceptionPanel />
        </aside>
      </div>
      {modalOpen && selectedHotel && selectedRoom && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, minWidth: 420, maxWidth: 600, boxShadow: '0 4px 24px #0002', position: 'relative' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 26, color: '#64748b', cursor: 'pointer' }} aria-label="Cerrar">×</button>
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 18 }}>Reserva de habitación</div>
            <div style={{ marginBottom: 16 }}>
              <div><b>Hotel:</b> {selectedHotel.hotel}</div>
              <div><b>Habitación:</b> {selectedRoom.name || selectedRoom.type}</div>
              <div><b>Tipo:</b> {selectedRoom.type}</div>
              <div><b>Capacidad:</b> {selectedRoom.capacity}</div>
              <div><b>Precio por noche:</b> {modalPricePerNight != null ? formatCurrency(modalPricePerNight) : "-"}</div>
              <div><b>Total:</b> {modalTotalPrice != null ? formatCurrency(modalTotalPrice) : "-"}</div>
            </div>
            <GuestFormModal
              hotel={selectedHotel}
              room={selectedRoom}
              checkin={form.checkin}
              checkout={form.checkout}
              onClose={handleCloseModal}
              onReservationConfirmed={(reservation) => {
                setConfirmedReservation(reservation);
                setPricePreviewDetail(null);
                adjustRoomPrices(reservation.price_detail, true);
                persistActiveReservation(
                  reservation,
                  "Reserva registrada. Revisa el resumen para continuar con el pago o gestionar cambios."
                );
              }}
              onPricePreview={handlePricePreview}
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
      <PaymentModal
        open={paymentModalOpen}
        reservation={paymentReservation}
        onClose={() => {
          setPaymentModalOpen(false);
          setPaymentReservation(null);
        }}
        onSuccess={handlePaymentSuccess}
        currencyFormatter={formatCurrency}
      />
    </div>
  );
}

