from flask import Flask, request, jsonify
from flask_cors import CORS

import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# --- Estructuras para reservas, ocupación y estadías ---
reservations = []  # reservas confirmadas
room_status = {}   # estado de habitaciones: {(hotel, room_type): 'Disponible'/'Ocupada'}
estadias = []      # historial de estadías

# --- Endpoint para registrar reservas (actualiza reservas y estado) ---

# --- Endpoint para check-in ---
@app.route('/api/checkin', methods=['POST'])
def checkin():
    data = request.json
    code = data.get('confirmation_code')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Buscar reserva
    res = next((r for r in reservations if r['confirmation_code'] == code), None)
    if not res:
        return jsonify({'error': 'No se puede realizar el check-in sin una reserva confirmada'}), 400
    # Validar fecha
    d_checkin = parse_date(res['checkin'])
    d_now = datetime.now()
    if d_now < d_checkin:
        return jsonify({'error': 'La fecha de check-in no puede ser anterior a la reservada'}), 400
    # Estado de habitación
    key = (res['hotel'], res['room_type'])
    if room_status.get(key) == 'Ocupada':
        return jsonify({'error': 'La habitación ya está ocupada'}), 400
    room_status[key] = 'Ocupada'
    res['status'] = 'ocupada'
    res['checkin_real'] = now
    return jsonify({'message': 'Check-in realizado', 'checkin': now, 'hotel': res['hotel'], 'room_type': res['room_type']})

# --- Endpoint para check-out ---
@app.route('/api/checkout', methods=['POST'])
def checkout():
    data = request.json
    code = data.get('confirmation_code')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Buscar reserva
    res = next((r for r in reservations if r['confirmation_code'] == code), None)
    if not res or res.get('status') != 'ocupada':
        return jsonify({'error': 'La habitación no se encuentra ocupada, no se puede realizar el check-out'}), 400
    # Validar fecha
    d_checkin_real = datetime.strptime(res['checkin_real'], '%Y-%m-%d %H:%M:%S')
    d_now = datetime.now()
    if d_now < d_checkin_real:
        return jsonify({'error': 'La fecha de check-out no puede ser anterior al check-in'}), 400
    # Estado de habitación
    key = (res['hotel'], res['room_type'])
    room_status[key] = 'Disponible'
    res['status'] = 'completada'
    res['checkout_real'] = now
    # Registrar estadía
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

# --- Endpoint para consultar historial de estadías ---
@app.route('/api/estadias', methods=['GET'])
def get_estadias():
    return jsonify(estadias)

# Endpoint de reservas
@app.route('/api/reservations', methods=['POST'])
def make_reservation():
    data = request.json
    # Validación básica
    required_fields = ['hotel', 'room_type', 'checkin', 'checkout', 'guests']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Falta el campo {field}'}), 400
    if not isinstance(data['guests'], list) or len(data['guests']) == 0:
        return jsonify({'error': 'Debe haber al menos un huésped'}), 400
    # Simular código de confirmación
    import random, string
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    # Calcular precio total (simulación básica)
    price = 0
    # Buscar hotel y tipo de habitación
    for h in hotels:
        if h['name'] == data['hotel']:
            for r in h['rooms']:
                if r['type'] == data['room_type']:
                    price = r['price']
    nights = 1
    try:
        d_checkin = parse_date(data['checkin'])
        d_checkout = parse_date(data['checkout'])
        nights = (d_checkout - d_checkin).days
    except:
        pass
    total = price * nights
    reservation = {
        'confirmation_code': code,
        'hotel': data['hotel'],
        'room_type': data['room_type'],
        'checkin': data['checkin'],
        'checkout': data['checkout'],
        'guests': data['guests'],
        'total': total,
        'status': 'confirmada'
    }
    reservations.append(reservation)
    return jsonify({
        'message': 'Reserva confirmada',
        'confirmation_code': code,
        'hotel': data['hotel'],
        'room_type': data['room_type'],
        'checkin': data['checkin'],
        'checkout': data['checkout'],
        'guests': data['guests'],
        'total': total
    })

# Datos simulados de hoteles y habitaciones
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
        "offers": [
            {"name": "Niños gratis temporada baja", "start": "01/05/2025", "end": "31/08/2025", "children_discount": 1.0}
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
        "offers": []
    }
]

def is_valid_city(city):
    return bool(re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$', city))

def parse_date(date_str):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            continue
    return None

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
        errors.append("La ciudad solo admite letras y espacios.")

    # Fechas
    checkin = data.get('checkin', '')
    checkout = data.get('checkout', '')
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    d_checkin = parse_date(checkin)
    d_checkout = parse_date(checkout)
    if not d_checkin or not d_checkout:
        errors.append("Formato de fecha inválido. Use dd/mm/yyyy.")
    elif d_checkin < today:
        errors.append("La fecha de entrada no puede ser menor a la actual.")
    elif d_checkout <= d_checkin:
        errors.append("La fecha de salida debe ser posterior a la de entrada.")

    # Tipo de habitación
    room_type = data.get('room_type', 'Single')
    if room_type not in ['Single', 'Doble', 'Suite']:
        errors.append("Tipo de habitación inválido.")

    # Cantidad de huéspedes
    try:
        adults = int(data.get('adults', 1))
        children = int(data.get('children', 0))
        babies = int(data.get('babies', 0))
    except Exception:
        errors.append("La cantidad de huéspedes debe ser un número entero positivo.")
        adults, children, babies = 1, 0, 0
    if adults < 1:
        errors.append("Debe haber al menos un adulto en la reserva.")
    if children < 0 or babies < 0:
        errors.append("No se permiten valores negativos en niños o bebés.")

    # Capacidad máxima por tipo de habitación
    max_caps = {
        'Single': {'adults': 1, 'children': 0, 'babies': 0},
        'Doble': {'adults': 2, 'children': 1, 'babies': 0},
        'Suite': {'adults': 3, 'children': 2, 'babies': 1},
    }
    cap = max_caps.get(room_type)
    if adults > cap['adults'] or children > cap['children'] or babies > cap['babies']:
        errors.append("La cantidad de huéspedes excede la capacidad de la habitación seleccionada.")

    if errors:
        return jsonify({"errors": errors}), 400

    # Filtrar hoteles por ciudad y disponibilidad simulada
    results = []
    for hotel in hotels:
        if hotel['city'].lower() != city.lower():
            continue
        available_rooms = []
        for room in hotel['rooms']:
            if room['type'] != room_type:
                continue
            rc = room['capacity']
            if adults > rc['adults'] or children > rc['children'] or babies > rc['babies']:
                continue
            # Calcular precio
            price_adult = room['price']
            price_child = price_adult * 0.5
            price_baby = 0
            # Ofertas
            offer_name = None
            for offer in hotel['offers']:
                o_start = parse_date(offer['start'])
                o_end = parse_date(offer['end'])
                if o_start and o_end and d_checkin >= o_start and d_checkout <= o_end:
                    if 'children_discount' in offer:
                        price_child = price_adult * (1 - offer['children_discount'])
                        offer_name = offer['name']
            total_price = price_adult * adults + price_child * children + price_baby * babies
            available_rooms.append({
                "type": room['type'],
                "price": total_price,
                "price_per_night": total_price / ((d_checkout - d_checkin).days),
                "offer": offer_name
            })
        if available_rooms:
            results.append({
                "hotel": hotel['name'],
                "rooms": available_rooms
            })

    if not results:
        return jsonify({"message": "No se encontraron hoteles disponibles con los criterios seleccionados"}), 404

    return jsonify(results)

@app.route('/')
def home():
    return 'DreamStay Backend - Flask API'

if __name__ == '__main__':
    app.run(debug=True)
