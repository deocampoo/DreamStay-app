from flask import Flask, request, jsonify
from flask_cors import CORS

import random
import re
import string
from datetime import datetime, timedelta
from collections import Counter

app = Flask(__name__)
CORS(app)

# In-memory stores
reservations = []
room_status = {}
estadias = []

hotels = [
    {
        "id": 1,
        "name": "Hotel Central",
        "city": "Buenos Aires",
        "rooms": [
            {
                "type": "Single",
                "name": "Single",
                "capacity": {"adults": 1, "children": 0, "babies": 0},
                "rates": {"adult": 100.0, "child": 100.0, "baby": 0.0},
            },
            {
                "type": "Doble",
                "name": "Doble",
                "capacity": {"adults": 2, "children": 1, "babies": 0},
                "rates": {"adult": 150.0, "child": 75.0, "baby": 0.0},
            },
            {
                "type": "Suite",
                "name": "Suite",
                "capacity": {"adults": 3, "children": 2, "babies": 1},
                "rates": {"adult": 250.0, "child": 125.0, "baby": 0.0},
            },
        ],
        "offers": [
            {
                "name": "Ni\u00f1os gratis temporada baja",
                "description": "Ni\u00f1os gratis en temporada baja",
                "start": "01/05/2025",
                "end": "31/08/2025",
                "children_discount": 1.0,
            }
        ],
    },
    {
        "id": 2,
        "name": "Hotel Playa",
        "city": "Mar del Plata",
        "rooms": [
            {
                "type": "Single",
                "name": "Single",
                "capacity": {"adults": 1, "children": 0, "babies": 0},
                "rates": {"adult": 90.0, "child": 90.0, "baby": 0.0},
            },
            {
                "type": "Doble",
                "name": "Doble",
                "capacity": {"adults": 2, "children": 1, "babies": 0},
                "rates": {"adult": 140.0, "child": 70.0, "baby": 0.0},
            },
            {
                "type": "Suite",
                "name": "Suite",
                "capacity": {"adults": 3, "children": 2, "babies": 1},
                "rates": {"adult": 220.0, "child": 110.0, "baby": 0.0},
            },
        ],
        "offers": [
            {
                "name": "Promo beb\u00e9s con cuna",
                "description": "Beb\u00e9s con cuna sin cargo",
                "start": "01/03/2025",
                "end": "31/12/2025",
                "baby_discount": 1.0,
            }
        ],
    },
]

CITY_REGEX = re.compile(r"^[0-9A-Za-z\u00c0-\u00ff ]+$")
NAME_REGEX = re.compile(r"^[A-Za-z\u00c0-\u00ff ]+$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_city(city: str) -> bool:
    return bool(CITY_REGEX.fullmatch(city))


def is_valid_name(name: str) -> bool:
    return bool(NAME_REGEX.fullmatch(name))


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_REGEX.fullmatch(value or ""))


def parse_date(date_str):
    if not date_str:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def format_date_output(date_obj: datetime) -> str:
    return date_obj.strftime("%d/%m/%Y")


def get_room(hotel_name, room_type):
    for hotel in hotels:
        if hotel["name"] == hotel_name:
            for room in hotel["rooms"]:
                if room["type"] == room_type:
                    return hotel, room
    return None, None


def dates_overlap(start1, end1, start2, end2):
    return start1 < end2 and start2 < end1


def is_room_available(hotel_name, room_type, start, end):
    key = (hotel_name, room_type)
    if room_status.get(key) == "Ocupada":
        return False
    for reservation in reservations:
        if reservation["hotel"] != hotel_name or reservation["room_type"] != room_type:
            continue
        if reservation.get("status") in ("confirmada", "ocupada"):
            res_start = parse_date(reservation["checkin"])
            res_end = parse_date(reservation["checkout"])
            if res_start and res_end and dates_overlap(res_start, res_end, start, end):
                return False
    return True


def format_capacity(capacity: dict) -> str:
    parts = []
    adults = capacity.get("adults", 0)
    children = capacity.get("children", 0)
    babies = capacity.get("babies", 0)
    if adults:
        parts.append(f"{adults} adulto{'s' if adults != 1 else ''}")
    if children:
        parts.append(f"{children} ni\u00f1o{'s' if children != 1 else ''}")
    if babies:
        parts.append(f"{babies} beb\u00e9{'s' if babies != 1 else ''}")
    return " + ".join(parts) if parts else "0 hu\u00e9spedes"


def normalize_counts(adults: int, children: int, babies: int) -> dict:
    return {"adult": adults, "child": children, "baby": babies}


def get_active_offers(hotel, start, end):
    active = []
    for offer in hotel.get("offers", []):
        offer_start = parse_date(offer.get("start"))
        offer_end = parse_date(offer.get("end"))
        if not offer_start or not offer_end:
            continue
        offer_end_exclusive = offer_end + timedelta(days=1)
        if dates_overlap(offer_start, offer_end_exclusive, start, end):
            active.append(offer)
    return active


def calculate_price(room, counts, nights, offers):
    counts_copy = {
        "adult": int(counts.get("adult", 0)),
        "child": int(counts.get("child", 0)),
        "baby": int(counts.get("baby", 0)),
    }
    rates = room.get("rates", {})
    adult_rate = float(rates.get("adult", room.get("price", 0.0)))
    child_rate = float(rates.get("child", adult_rate * 0.5))
    baby_rate = float(rates.get("baby", 0.0))

    applied_offers = []
    for offer in offers:
        applied = False
        if offer.get("adult_discount"):
            adult_rate = max(adult_rate * (1 - float(offer["adult_discount"])), 0.0)
            applied = True
        if offer.get("children_discount"):
            child_rate = max(child_rate * (1 - float(offer["children_discount"])), 0.0)
            applied = True
        if offer.get("baby_discount"):
            baby_rate = max(baby_rate * (1 - float(offer["baby_discount"])), 0.0)
            applied = True
        if applied:
            applied_offers.append(offer.get("description") or offer.get("name"))

    subtotal_per_night = (
        adult_rate * counts_copy["adult"]
        + child_rate * counts_copy["child"]
        + baby_rate * counts_copy["baby"]
    )
    total = subtotal_per_night * nights

    detail = {
        "nights": nights,
        "counts": counts_copy,
        "per_night": {
            "adult": round(adult_rate, 2),
            "child": round(child_rate, 2),
            "baby": round(baby_rate, 2),
        },
        "subtotal_per_night": round(subtotal_per_night, 2),
        "total": round(total, 2),
    }

    return detail, applied_offers


@app.route("/api/hotels/search", methods=["POST", "GET"])
def search_hotels():
    if request.method == "POST":
        data = request.json or {}
    else:
        data = {
            "city": request.args.get("city", ""),
            "checkin": request.args.get("from", ""),
            "checkout": request.args.get("to", ""),
            "room_type": request.args.get("roomType", "Single"),
            "adults": request.args.get("adults", 1),
            "children": request.args.get("children", 0),
            "babies": request.args.get("babies", 0),
            "tzOffset": request.args.get("tzOffset"),
        }

    errors = []

    city = str(data.get("city", "")).strip()
    if not city:
        errors.append("La ciudad es obligatoria.")
    elif not is_valid_city(city):
        errors.append("La ciudad solo admite letras, n\u00fameros y espacios.")

    checkin = data.get("checkin", "")
    checkout = data.get("checkout", "")

    tz_offset_raw = data.get("tzOffset") if request.method == "POST" else data.get("tzOffset")
    try:
        tz_offset_minutes = int(tz_offset_raw) if tz_offset_raw is not None else 0
    except (TypeError, ValueError):
        tz_offset_minutes = 0

    today = (
        datetime.utcnow() - timedelta(minutes=tz_offset_minutes)
    ).replace(hour=0, minute=0, second=0, microsecond=0)

    d_checkin = parse_date(checkin)
    d_checkout = parse_date(checkout)

    if not d_checkin:
        errors.append("La fecha de entrada es obligatoria y debe tener formato dd/mm/yyyy.")
    elif d_checkin < today:
        errors.append("La fecha de entrada no puede ser menor a la actual.")

    if not d_checkout:
        errors.append("La fecha de salida es obligatoria y debe tener formato dd/mm/yyyy.")
    elif d_checkin and d_checkout <= d_checkin:
        errors.append("La fecha de salida debe ser posterior a la de entrada.")

    room_type = data.get("room_type") or "Single"
    available_types = {room["type"] for hotel in hotels for room in hotel["rooms"]}
    if room_type != "Todos" and room_type not in available_types:
        errors.append("Tipo de habitaci\u00f3n inv\u00e1lido.")

    try:
        adults = int(data.get("adults", 1))
        children = int(data.get("children", 0))
        babies = int(data.get("babies", 0))
    except (TypeError, ValueError):
        errors.append("La cantidad de hu\u00e9spedes debe ser un n\u00famero entero positivo.")
        adults, children, babies = 1, 0, 0

    if adults < 1:
        errors.append("Debe haber al menos un adulto en la reserva.")
    if children < 0 or babies < 0:
        errors.append("No se permiten valores negativos en ni\u00f1os o beb\u00e9s.")

    if room_type != "Todos" and room_type in available_types:
        selected_capacity = None
        for hotel in hotels:
            for room in hotel["rooms"]:
                if room["type"] == room_type:
                    selected_capacity = room["capacity"]
                    break
            if selected_capacity:
                break
        if selected_capacity:
            if (
                adults > selected_capacity["adults"]
                or children > selected_capacity["children"]
                or babies > selected_capacity["babies"]
            ):
                errors.append("La habitaci\u00f3n seleccionada no admite la cantidad de hu\u00e9spedes indicada.")

    if errors:
        return jsonify({"errors": errors}), 400

    counts = normalize_counts(adults, children, babies)
    nights = max((d_checkout - d_checkin).days, 1)

    results = []
    for hotel in hotels:
        if hotel["city"].lower() != city.lower():
            continue

        hotel_active_offers = get_active_offers(hotel, d_checkin, d_checkout)
        offer_labels = [offer.get("description") or offer.get("name") for offer in hotel_active_offers]

        available_rooms = []
        for room in hotel["rooms"]:
            if room_type != "Todos" and room["type"] != room_type:
                continue

            capacity = room["capacity"]
            if (
                counts["adult"] > capacity["adults"]
                or counts["child"] > capacity["children"]
                or counts["baby"] > capacity["babies"]
            ):
                continue

            if not is_room_available(hotel["name"], room["type"], d_checkin, d_checkout):
                continue

            price_detail, applied_offers = calculate_price(room, counts, nights, hotel_active_offers)

            room_entry = {
                "name": room.get("name", room["type"]),
                "type": room["type"],
                "capacity": format_capacity(capacity),
                "capacity_breakdown": capacity,
                "state": "Disponible",
                "price_per_night": price_detail["subtotal_per_night"],
                "price": price_detail["total"],
                "offer": ", ".join(applied_offers) if applied_offers else None,
                "price_detail": price_detail,
            }
            available_rooms.append(room_entry)

        if available_rooms:
            available_rooms.sort(key=lambda item: item["price_per_night"])
            results.append(
                {
                    "hotel": hotel["name"],
                    "city": hotel["city"],
                    "offers": offer_labels,
                    "rooms": available_rooms,
                    "nights": nights,
                }
            )

    if results:
        results.sort(key=lambda item: item["rooms"][0]["price_per_night"])

    return jsonify(results)


@app.route("/api/reservations", methods=["POST", "OPTIONS"])
def make_reservation():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    contact_email_raw = str(data.get("contact_email", "")).strip()
    if not contact_email_raw:
        return jsonify({"error": "El correo electronico de contacto es obligatorio"}), 400
    if not is_valid_email(contact_email_raw):
        return jsonify({"error": "El correo electronico de contacto tiene un formato invalido"}), 400
    required_fields = ["hotel", "room_type", "checkin", "checkout", "guests"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Falta el campo {field}"}), 400

    hotel_name = data["hotel"]
    room_type = data["room_type"]
    hotel, room = get_room(hotel_name, room_type)
    if not hotel or not room:
        return jsonify({"error": "Hotel o tipo de habitaci\u00f3n inv\u00e1lido"}), 400

    d_checkin = parse_date(data["checkin"])
    d_checkout = parse_date(data["checkout"])
    if not d_checkin or not d_checkout or d_checkout <= d_checkin:
        return jsonify({"error": "Fechas inv\u00e1lidas"}), 400

    guests = data.get("guests", [])
    if not isinstance(guests, list) or not guests:
        return jsonify({"error": "Debe haber al menos un hu\u00e9sped"}), 400

    counts = Counter()
    processed_guests = []
    today = datetime.now().date()

    for idx, guest in enumerate(guests, start=1):
        name = str(guest.get("name", "")).strip()
        birth_raw = str(guest.get("birth", "")).strip()

        if not name:
            return jsonify({"error": f"El nombre del hu\u00e9sped {idx} es obligatorio"}), 400
        if not is_valid_name(name):
            return jsonify({"error": f"El nombre del hu\u00e9sped {idx} solo admite letras y espacios"}), 400

        birth_date = parse_date(birth_raw)
        if not birth_date:
            return jsonify({"error": f"La fecha de nacimiento del hu\u00e9sped {idx} debe tener formato dd/mm/yyyy"}), 400

        age = today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )
        if age < 0:
            return jsonify({"error": f"La fecha de nacimiento del hu\u00e9sped {idx} no puede ser futura"}), 400

        if age >= 18:
            category = "adult"
        elif age >= 2:
            category = "child"
        else:
            category = "baby"

        counts[category] += 1
        processed_guests.append(
            {
                "name": name,
                "birth": format_date_output(birth_date),
                "age": age,
                "category": category,
            }
        )

    counts_dict = normalize_counts(counts.get("adult", 0), counts.get("child", 0), counts.get("baby", 0))

    if counts_dict["adult"] == 0:
        return jsonify({"error": "Debe haber al menos un adulto en la reserva"}), 400

    capacity = room["capacity"]
    if (
        counts_dict["adult"] > capacity["adults"]
        or counts_dict["child"] > capacity["children"]
        or counts_dict["baby"] > capacity["babies"]
    ):
        return jsonify({"error": "La cantidad de hu\u00e9spedes excede la capacidad de la habitaci\u00f3n seleccionada"}), 400

    if not is_room_available(hotel_name, room_type, d_checkin, d_checkout):
        return jsonify({"error": "La habitaci\u00f3n seleccionada no tiene disponibilidad para esas fechas"}), 400

    nights = max((d_checkout - d_checkin).days, 1)
    hotel_active_offers = get_active_offers(hotel, d_checkin, d_checkout)
    price_detail, applied_offers = calculate_price(room, counts_dict, nights, hotel_active_offers)

    confirmation_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    reservation = {
        "confirmation_code": confirmation_code,
        "hotel": hotel_name,
        "room_type": room_type,
        "room_name": room.get("name", room_type),
        "contact_email": contact_email_raw,
        "checkin": format_date_output(d_checkin),
        "checkout": format_date_output(d_checkout),
        "guests": processed_guests,
        "price_detail": price_detail,
        "total": price_detail["total"],
        "offer": ", ".join(applied_offers) if applied_offers else None,
        "offers": applied_offers,
        "counts": counts_dict,
        "nights": nights,
        "status": "confirmada",
    }

    reservations.append(reservation)
    return jsonify(reservation)


@app.route("/api/reservations/search", methods=["POST", "OPTIONS"])
def search_reservation():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    code = str(data.get("code", "")).strip().upper()
    email_raw = str(data.get("email", "")).strip()
    email_normalized = email_raw.lower()

    if not code:
        return jsonify({"error": "El codigo de reserva es obligatorio"}), 400
    if not email_raw:
        return jsonify({"error": "El correo electronico es obligatorio"}), 400
    if not is_valid_email(email_raw):
        return jsonify({"error": "El correo electronico tiene un formato invalido"}), 400

    reservation = next(
        (
            res
            for res in reservations
            if res["confirmation_code"] == code
            and str(res.get("contact_email", "")).strip().lower() == email_normalized
        ),
        None,
    )

    if not reservation:
        return jsonify(
            {"error": "No se encontro una reserva asociada a los datos ingresados."}
        ), 404

    response_payload = reservation.copy()
    return jsonify({"reservation": response_payload})


@app.route("/api/price-preview", methods=["POST", "OPTIONS"])
def price_preview():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    hotel_name = str(data.get("hotel", "")).strip()
    room_type = data.get("room_type")
    if not hotel_name or not room_type:
        return jsonify({"error": "Hotel y tipo de habitación son obligatorios"}), 400

    hotel, room = get_room(hotel_name, room_type)
    if not hotel or not room:
        return jsonify({"error": "Hotel o tipo de habitación inválido"}), 400

    d_checkin = parse_date(data.get("checkin"))
    d_checkout = parse_date(data.get("checkout"))
    if not d_checkin or not d_checkout or d_checkout <= d_checkin:
        return jsonify({"error": "Fechas inválidas"}), 400

    counts_payload = data.get("counts") or {}
    try:
        adult_count = int(counts_payload.get("adult", 0))
        child_count = int(counts_payload.get("child", 0))
        baby_count = int(counts_payload.get("baby", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Los conteos de huéspedes deben ser números enteros"}), 400

    if adult_count < 1:
        return jsonify({"error": "Debe haber al menos un adulto en la reserva"}), 400
    if child_count < 0 or baby_count < 0:
        return jsonify({"error": "Los conteos no pueden ser negativos"}), 400

    capacity = room["capacity"]
    if (
        adult_count > capacity["adults"]
        or child_count > capacity["children"]
        or baby_count > capacity["babies"]
    ):
        return jsonify({"error": "La cantidad de huéspedes excede la capacidad de la habitación seleccionada"}), 400

    counts = normalize_counts(adult_count, child_count, baby_count)
    nights = max((d_checkout - d_checkin).days, 1)
    hotel_active_offers = get_active_offers(hotel, d_checkin, d_checkout)
    price_detail, applied_offers = calculate_price(room, counts, nights, hotel_active_offers)

    return jsonify(
        {
            "price_detail": price_detail,
            "offer": ", ".join(applied_offers) if applied_offers else None,
        }
    )


@app.route("/api/checkin", methods=["POST", "OPTIONS"])
def checkin():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    code = str(data.get("confirmation_code", "")).strip().upper()
    if not code:
        return jsonify({"error": "Debe proporcionar el c\u00f3digo de confirmaci\u00f3n"}), 400

    reservation = next((r for r in reservations if r["confirmation_code"] == code), None)
    if not reservation or reservation["status"] != "confirmada":
        return jsonify({"error": "No se puede realizar el check-in sin una reserva confirmada"}), 400

    checkin_date = parse_date(reservation["checkin"])
    if checkin_date and datetime.now() < datetime.combine(checkin_date, datetime.min.time()):
        return jsonify({"error": "La fecha de check-in no puede ser anterior a la reservada"}), 400

    key = (reservation["hotel"], reservation["room_type"])
    if room_status.get(key) == "Ocupada":
        return jsonify({"error": "La habitaci\u00f3n ya est\u00e1 ocupada"}), 400

    room_status[key] = "Ocupada"
    reservation["status"] = "ocupada"
    reservation["checkin_real"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return jsonify(
        {
            "message": "Check-in realizado",
            "hotel": reservation["hotel"],
            "room_type": reservation["room_type"],
            "checkin": reservation["checkin_real"],
        }
    )


@app.route("/api/checkout", methods=["POST", "OPTIONS"])
def checkout():
    if request.method == "OPTIONS":
        return "", 204

    data = request.json or {}
    code = str(data.get("confirmation_code", "")).strip().upper()
    if not code:
        return jsonify({"error": "Debe proporcionar el c\u00f3digo de confirmaci\u00f3n"}), 400

    reservation = next((r for r in reservations if r["confirmation_code"] == code), None)
    if not reservation or reservation.get("status") != "ocupada":
        return jsonify({"error": "La habitaci\u00f3n no se encuentra ocupada, no se puede realizar el check-out"}), 400

    checkout_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    reservation["status"] = "completada"
    reservation["checkout_real"] = checkout_time

    key = (reservation["hotel"], reservation["room_type"])
    room_status[key] = "Disponible"

    estadias.append(
        {
            "confirmation_code": reservation["confirmation_code"],
            "hotel": reservation["hotel"],
            "room_type": reservation["room_type"],
            "guests": reservation["guests"],
            "checkin": reservation.get("checkin_real"),
            "checkout": checkout_time,
            "total": reservation["total"],
            "price_detail": reservation.get("price_detail"),
            "offers": reservation.get("offers"),
        }
    )

    return jsonify(
        {
            "message": "Check-out realizado",
            "hotel": reservation["hotel"],
            "room_type": reservation["room_type"],
            "checkout": checkout_time,
        }
    )


@app.route("/api/estadias", methods=["GET"])
def get_estadias():
    return jsonify(estadias)


@app.route("/")
def home():
    return "DreamStay Backend - Flask API"


if __name__ == "__main__":
    app.run(debug=True)
