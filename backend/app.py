from flask import Flask, request, jsonify
from flask_cors import CORS

import re
import random
import string
from datetime import datetime
from collections import Counter

app = Flask(__name__)
CORS(app)

# --- Estructuras para reservas, ocupaciÃ³n y estadÃ­as ---
reservations = []  # reservas confirmadas
room_status = {}   # estado de habitaciónes: {(hotel, room_type): 'Disponible'/'Ocupada'}
estadias = []      # historial de estadÃ­as

# --- Endpoint para registrar reservas (actualiza reservas y estado) ---

# --- Endpoint para check-in ---
@app.route('/api/checkin', methods=['POST'])
def checkin():
    data = request.json
    code = str(data.get('confirmation_code', '')).strip().upper()
    if not code:
        return jsonify({'error': 'Debe proporcionar el código de confirmación'}), 400
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Buscar reserva
    res = next((r for r in reservations if r['confirmation_code'] == code), None)
    if not res or res.get('status') != 'confirmada':
        return jsonify({'error': 'No se puede realizar el check-in sin una reserva confirmada'}), 400
    # Validar fecha
    d_checkin = parse_date(res['checkin'])
    d_now = datetime.now()
    if d_now < d_checkin:
        return jsonify({'error': 'La fecha de check-in no puede ser anterior a la reservada'}), 400
    # Estado de habitaciÃ³n
    key = (res['hotel'], res['room_type'])
    if room_status.get(key) == 'Ocupada':
        return jsonify({'error': 'La habitaciÃ³n ya estÃ¡ ocupada'}), 400
    room_status[key] = 'Ocupada'
    res['status'] = 'ocupada'
    res['checkin_real'] = now
    return jsonify({'message': 'Check-in realizado', 'checkin': now, 'hotel': res['hotel'], 'room_type': res['room_type']})

# --- Endpoint para check-out ---
@app.route('/api/checkout', methods=['POST'])
def checkout():
    data = request.json
    code = str(data.get('confirmation_code', '')).strip().upper()
    if not code:
        return jsonify({'error': 'Debe proporcionar el código de confirmación'}), 400
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Buscar reserva
    res = next((r for r in reservations if r['confirmation_code'] == code), None)
    if not res or res.get('status') != 'ocupada':
        return jsonify({'error': 'La habitaciÃ³n no se encuentra ocupada, no se puede realizar el check-out'}), 400
    # Validar fecha
    d_checkin_real = datetime.strptime(res['checkin_real'], '%Y-%m-%d %H:%M:%S')
    d_now = datetime.now()
    if d_now < d_checkin_real:
        return jsonify({'error': 'La fecha de check-out no puede ser anterior al check-in'}), 400
    # Estado de habitaciÃ³n
    key = (res['hotel'], res['room_type'])
    room_status[key] = 'Disponible'
    res['status'] = 'completada'
    res['checkout_real'] = now
    # Registrar estadÃ­a
    estadia = {
        'guests': res['guests'],
        'hotel': res['hotel'],
        'room_type': res['room_type'],
        'checkin': res['checkin_real'],
        'checkout': now,
        'total': res['total']
    }
    estadias.append(estadia)
    return jsonify({'message': 'Check-out realizado', 'checkout': now, 'hotel': res['hotel'], 'room_type': res['room_type']})

# --- Endpoint para consultar historial de estadÃ­as ---
@app.route('/api/estadias', methods=['GET'])
def get_estadias():
    return jsonify(estadias)

# Endpoint de reservas

@app.route('/api/reservations', methods=['POST'])
def make_reservation():
    data = request.json
    required_fields = ['hotel', 'room_type', 'checkin', 'checkout', 'guests']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Falta el campo {field}'}), 400
    if not isinstance(data['guests'], list) or len(data['guests']) == 0:
        return jsonify({'error': 'Debe haber al menos un huésped'}), 400

    hotel = next((h for h in hotels if h['name'] == data['hotel']), None)
    if not hotel:
        return jsonify({'error': 'Hotel no encontrado'}), 400
    room = next((r for r in hotel['rooms'] if r['type'] == data['room_type']), None)
    if not room:
        return jsonify({'error': 'Tipo de habitación no disponible en el hotel seleccionado'}), 400

    d_checkin = parse_date(data['checkin'])
    d_checkout = parse_date(data['checkout'])
    if not d_checkin or not d_checkout:
        return jsonify({'error': 'Fechas de check-in y check-out invalidas. Use dd/mm/yyyy'}), 400
    if d_checkout <= d_checkin:
        return jsonify({'error': 'La fecha de salida debe ser posterior a la de entrada'}), 400

    processed_guests = []
    today = datetime.now().date()
    for idx, guest in enumerate(data['guests'], start=1):
        name = str(guest.get('name', '')).strip()
        birth_str = str(guest.get('birth', '')).strip()
        if not name:
            return jsonify({'error': f'Nombre del huésped {idx} es obligatorio'}), 400
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$', name):
            return jsonify({'error': f'Nombre del huésped {idx} solo admite letras y espacios'}), 400
        birth_date = parse_date(birth_str)
        if not birth_date:
            return jsonify({'error': f'Fecha de nacimiento del huésped {idx} es obligatoria y debe tener formato dd/mm/yyyy'}), 400
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        if age < 0:
            return jsonify({'error': f'Fecha de nacimiento del huésped {idx} no puede ser futura'}), 400
        if age >= 18:
            category = 'adult'
        elif age >= 2:
            category = 'child'
        else:
            category = 'baby'
        processed_guests.append({
            'name': name,
            'birth': birth_str,
            'age': age,
            'category': category
        })

    counts = Counter(g['category'] for g in processed_guests)
    if counts.get('adult', 0) == 0:
        return jsonify({'error': 'Debe haber al menos un adulto en la reserva'}), 400

    capacity = room.get('capacity', {})
    if (
        counts.get('adult', 0) > capacity.get('adults', 0)
        or counts.get('child', 0) > capacity.get('children', 0)
        or counts.get('baby', 0) > capacity.get('babies', 0)
    ):
        return jsonify({'error': 'La cantidad de huéspedes excede la capacidad de la habitación seleccionada'}), 400

    nights = (d_checkout - d_checkin).days
    if nights <= 0:
        nights = 1

    base_price = room['price']
    hotel_pricing = hotel.get('pricing')
    room_pricing = room.get('pricing')

    price_per_night_adult = get_guest_rate(base_price, room_pricing, hotel_pricing, 'adult', 1.0)
    price_per_night_child = get_guest_rate(base_price, room_pricing, hotel_pricing, 'child', 0.5)
    price_per_night_baby = get_guest_rate(base_price, room_pricing, hotel_pricing, 'baby', 0.0)

    offer_applied = None
    for offer in hotel.get('offers', []):
        offer_start = parse_date(offer.get('start', ''))
        offer_end = parse_date(offer.get('end', ''))
        if offer_start and offer_end and d_checkin >= offer_start and d_checkout <= offer_end:
            if offer.get('children_discount') is not None:
                price_per_night_child *= (1 - offer['children_discount'])
            if offer.get('baby_discount') is not None:
                price_per_night_baby *= (1 - offer['baby_discount'])
            offer_applied = offer.get('name')

    subtotal_per_night = (
        price_per_night_adult * counts.get('adult', 0) +
        price_per_night_child * counts.get('child', 0) +
        price_per_night_baby * counts.get('baby', 0)
    )
    total = subtotal_per_night * nights

    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    price_detail = {
        'nights': nights,
        'counts': {
            'adult': counts.get('adult', 0),
            'child': counts.get('child', 0),
            'baby': counts.get('baby', 0)
        },
        'per_night': {
            'adult': price_per_night_adult,
            'child': price_per_night_child,
            'baby': price_per_night_baby
        },
        'subtotal_per_night': subtotal_per_night,
        'total': total
    }

    reservation = {
        'confirmation_code': code,
        'hotel': data['hotel'],
        'room_type': data['room_type'],
        'checkin': data['checkin'],
        'checkout': data['checkout'],
        'guests': processed_guests,
        'total': total,
        'offer': offer_applied,
        'price_detail': price_detail,
        'status': 'confirmada'
    }
    reservations.append(reservation)
    response = {
        'message': 'Reserva confirmada',
        'confirmation_code': code,
        'hotel': reservation['hotel'],
        'room_type': reservation['room_type'],
        'checkin': reservation['checkin'],
        'checkout': reservation['checkout'],
        'guests': processed_guests,
        'total': total,
        'offer': offer_applied,
        'price_detail': price_detail
    }
    return jsonify(response)

# Datos simulados de hoteles y habitaciónes
hotels = [
    {
        "id": 1,
        "name": "Hotel Central",
        "city": "Buenos Aires",
        "rooms": [
            {"type": "Single", "price": 100, "capacity": {"adults": 1, "children": 0, "babies": 0}},
            {"type": "Doble", "price": 150, "capacity": {"adults": 2, "children": 1, "babies": 0}},
            {"type": "Suite", "price": 250, "capacity": {"adults": 3, "children": 2, "babies": 1}},
        ],
        "pricing": {"child_factor": 0.5, "baby_factor": 0.0},
        "offers": [
            {"name": "NiÃ±os gratis temporada baja", "start": "01/05/2025", "end": "31/08/2025", "children_discount": 1.0}
        ]
    },
    {
        "id": 2,
        "name": "Hotel Playa",
        "city": "Mar del Plata",
        "rooms": [
            {"type": "Single", "price": 90, "capacity": {"adults": 1, "children": 0, "babies": 0}},
            {"type": "Doble", "price": 140, "capacity": {"adults": 2, "children": 1, "babies": 0}},
            {"type": "Suite", "price": 220, "capacity": {"adults": 3, "children": 2, "babies": 1}},
        ],
        "pricing": {"child_factor": 0.4, "baby_rate": 25},
        "offers": []
    }
]

def is_valid_city(city):
    return bool(re.match(r'^[A-Za-z0-9 ]+$', city))

def parse_date(date_str):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            continue
    return None


def get_guest_rate(base_price, room_pricing, hotel_pricing, key, default_factor):
    room_pricing = room_pricing or {}
    hotel_pricing = hotel_pricing or {}
    rate_key = f"{key}_rate"
    factor_key = f"{key}_factor"
    if rate_key in room_pricing:
        return room_pricing[rate_key]
    if rate_key in hotel_pricing:
        return hotel_pricing[rate_key]
    factor = room_pricing.get(factor_key)
    if factor is None:
        factor = hotel_pricing.get(factor_key, default_factor)
    return base_price * factor


def is_room_available(hotel_name, room_type, d_checkin, d_checkout):
    key = (hotel_name, room_type)
    if room_status.get(key) == 'Ocupada':
        return False
    for res in reservations:
        if res.get('hotel') != hotel_name or res.get('room_type') != room_type:
            continue
        status = res.get('status', 'confirmada')
        if status not in ('confirmada', 'ocupada'):
            continue
        res_checkin = parse_date(res.get('checkin'))
        res_checkout = parse_date(res.get('checkout'))
        if not res_checkin or not res_checkout:
            continue
        if res_checkout > d_checkin and res_checkin < d_checkout:
            return False
    return True

@app.route('/api/hotels/search', methods=['POST', 'GET'])
def search_hotels():
    if request.method == 'POST':
        data = request.json
    else:
        data = {
            'city': request.args.get('city', ''),
            'checkin': request.args.get('from', ''),
            'checkout': request.args.get('to', ''),
            'room_type': request.args.get('roomType', 'Single'),
            'adults': request.args.get('adults', 1),
            'children': request.args.get('children', 0),
            'babies': request.args.get('babies', 0),
        }
    errors = []

    # Validaciones de ciudad
    city = data.get('city', '').strip()
    if not city:
        errors.append("La ciudad es obligatoria.")
    elif not is_valid_city(city):
        errors.append("La ciudad solo admite caracteres alfanumericos y espacios.")

    # Fechas
    checkin = data.get('checkin', '')
    checkout = data.get('checkout', '')
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    d_checkin = parse_date(checkin)
    d_checkout = parse_date(checkout)
    if not d_checkin or not d_checkout:
        errors.append("Formato de fecha invÃ¡lido. Use dd/mm/yyyy.")
    elif d_checkin < today:
        errors.append("La fecha de entrada no puede ser menor a la actual.")
    elif d_checkout <= d_checkin:
        errors.append("La fecha de salida debe ser posterior a la de entrada.")

    # Tipo de habitaciÃ³n
    room_type = data.get('room_type', 'Single')
    if room_type not in ['Single', 'Doble', 'Suite', 'Todos']:
        errors.append("Tipo de habitaciÃ³n invÃ¡lido.")

    # Cantidad de huÃ©spedes
    try:
        adults = int(data.get('adults', 1))
        children = int(data.get('children', 0))
        babies = int(data.get('babies', 0))
    except Exception:
        errors.append("La cantidad de huÃ©spedes debe ser un nÃºmero entero positivo.")
        adults, children, babies = 1, 0, 0
    if adults < 1:
        errors.append("Debe haber al menos un adulto en la reserva.")
    if children < 0 or babies < 0:
        errors.append("No se permiten valores negativos en niÃ±os o bebÃ©s.")

    # Capacidad mÃ¡xima por tipo de habitaciÃ³n
    max_caps = {
        'Single': {'adults': 1, 'children': 0, 'babies': 0},
        'Doble': {'adults': 2, 'children': 1, 'babies': 0},
        'Suite': {'adults': 3, 'children': 2, 'babies': 1},
    }
    if room_type != 'Todos':
        cap = max_caps.get(room_type)
        if adults > cap['adults'] or children > cap['children'] or babies > cap['babies']:
            errors.append("La cantidad de huéspedes excede la capacidad de la habitación seleccionada.")

    if errors:
        return jsonify({"errors": errors}), 400

    nights = (d_checkout - d_checkin).days
    if nights <= 0:
        nights = 1

    results = []
    for hotel in hotels:
        if hotel['city'].lower() != city.lower():
            continue
        hotel_rooms = []
        for room in hotel['rooms']:
            rc = room['capacity']
            if adults > rc.get('adults', 0) or children > rc.get('children', 0) or babies > rc.get('babies', 0):
                continue
            if not is_room_available(hotel['name'], room['type'], d_checkin, d_checkout):
                continue

            capacity_parts = []
            adults_cap = rc.get('adults', 0)
            capacity_parts.append(f"{adults_cap} Adulto{'s' if adults_cap != 1 else ''}")
            children_cap = rc.get('children', 0)
            if children_cap:
                capacity_parts.append(f"{children_cap} Niño{'s' if children_cap != 1 else ''}")
            babies_cap = rc.get('babies', 0)
            if babies_cap:
                capacity_parts.append(f"{babies_cap} Bebé{'s' if babies_cap != 1 else ''}")
            capacity_label = " + ".join(capacity_parts)

            room_name = room.get('name') or f"Habitación {room['type']}"

            price_adult = room['price']
            hotel_pricing = hotel.get('pricing')
            room_pricing = room.get('pricing')
            price_child = get_guest_rate(price_adult, room_pricing, hotel_pricing, 'child', 0.5)
            price_baby = get_guest_rate(price_adult, room_pricing, hotel_pricing, 'baby', 0.0)

            offer_name = None
            for offer in hotel.get('offers', []):
                o_start = parse_date(offer.get('start', ''))
                o_end = parse_date(offer.get('end', ''))
                if o_start and o_end and d_checkin >= o_start and d_checkout <= o_end:
                    if offer.get('children_discount') is not None:
                        price_child *= (1 - offer['children_discount'])
                    if offer.get('baby_discount') is not None:
                        price_baby *= (1 - offer['baby_discount'])
                    offer_name = offer.get('name')

            price_per_night = price_adult * adults + price_child * children + price_baby * babies
            total_price = price_per_night * nights

            hotel_rooms.append({
                "name": room_name,
                "type": room['type'],
                "capacity": capacity_label,
                "price": total_price,
                "price_per_night": price_per_night,
                "offer": offer_name,
                "state": "Disponible"
            })

        if hotel_rooms:
            hotel_rooms.sort(key=lambda r: r['price_per_night'])
            if room_type != 'Todos':
                hotel_rooms = [r for r in hotel_rooms if r['type'] == room_type]
            if hotel_rooms:
                results.append({
                    "hotel": hotel['name'],
                    "rooms": hotel_rooms
                })

    if not results:
        return jsonify({"message": "No se encontraron habitaciones disponibles para los criterios seleccionados"}), 404

    return jsonify(results)

@app.route('/')
def home():
    return 'DreamStay Backend - Flask API'

if __name__ == '__main__':
    app.run(debug=True)

