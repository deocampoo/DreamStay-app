import React, { useState, useEffect } from "react";

// Igual lógica: local → localhost, producción → Render
const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5000"
    : "https://dreamstay-app.onrender.com";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/$/, "");

export default function HotelRoomsList({
  hotelName,
  checkin,
  checkout,
  open,
  onClose,
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");

    fetch(
      `${API_BASE_URL}/api/hotels/${encodeURIComponent(
        hotelName
      )}/rooms?checkin=${checkin || ""}&checkout=${checkout || ""}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRooms(data);
        else
          setError(
            data.error || "No se pudieron cargar las habitaciones"
          );
        setLoading(false);
      })
      .catch(() => {
        setError("Error de conexión con el backend");
        setLoading(false);
      });
  }, [hotelName, checkin, checkout, open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.25)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          minWidth: 420,
          maxWidth: 600,
          boxShadow: "0 4px 24px #0002",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            background: "none",
            border: "none",
            fontSize: 26,
            color: "#64748b",
            cursor: "pointer",
          }}
          aria-label="Cerrar"
        >
          ×
        </button>
        <div
          style={{
            fontWeight: 600,
            fontSize: 22,
            marginBottom: 18,
          }}
        >
          Habitaciones de {hotelName}
        </div>
        {loading && <div>Cargando habitaciones...</div>}
        {error && (
          <div style={{ color: "#DC2626", marginBottom: 12 }}>
            {error}
          </div>
        )}
        {!loading && !error && rooms.length === 0 && (
          <div>
            No hay habitaciones disponibles para las fechas seleccionadas.
          </div>
        )}
        {!loading && !error && rooms.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 15,
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "left",
                  }}
                >
                  Nombre
                </th>
                <th
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "left",
                  }}
                >
                  Tipo
                </th>
                <th
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "left",
                  }}
                >
                  Capacidad
                </th>
                <th
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "left",
                  }}
                >
                  Precio/noche
                </th>
                <th
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "left",
                  }}
                >
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? "#fff" : "#f8fafc",
                  }}
                >
                  <td style={{ padding: 8 }}>{room.nombre}</td>
                  <td style={{ padding: 8 }}>{room.tipo}</td>
                  <td style={{ padding: 8 }}>
                    {`Adultos: ${room.capacidad.adults}, Niños: ${room.capacidad.children}, Bebés: ${room.capacidad.babies}`}
                  </td>
                  <td style={{ padding: 8 }}>
                    ${room.precio_por_noche}
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        color:
                          room.estado === "disponible"
                            ? "#16A34A"
                            : "#DC2626",
                        fontWeight: 600,
                      }}
                    >
                      {room.estado.charAt(0).toUpperCase() +
                        room.estado.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
