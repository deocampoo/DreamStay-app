import random
import string
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def generate_confirmation_code(length=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

# Clasificación de huésped según edad
def classify_guest(age):
    if age >= 18:
        return "Adulto"
    elif age >= 2:
        return "Niño"
    elif age >= 0:
        return "Bebé"
    return "Desconocido"

@app.route('/api/reservations', methods=['POST'])
def make_reservation():
    data = request.json
    errors = []
    # Validar datos mínimos
    required_fields = ['hotel', 'room_type', 'checkin', 'checkout', 'guests']
    for field in required_fields:
        if field not in data:
            errors.append(f"Falta el campo obligatorio: {field}")
    if errors:
        return jsonify({"errors": errors}), 400

    # Validar huéspedes
    guests = data['guests']
    if not isinstance(guests, list) or len(guests) == 0:
        return jsonify({"errors": ["Debe registrar al menos un huésped."]}), 400
    # Validar nombre y fecha de nacimiento
    for i, g in enumerate(guests):
        if not g.get('name') or not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$', g['name']):
            errors.append(f"Nombre inválido para huésped {i+1}.")
        if not g.get('birth'):
            errors.append(f"Fecha de nacimiento obligatoria para huésped {i+1}.")
        else:
            try:
                birth = datetime.strptime(g['birth'], "%Y-%m-%d")
                today = datetime.now()
                age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                guests[i]['age'] = age
                guests[i]['type'] = classify_guest(age)
            except Exception:
                errors.append(f"Fecha de nacimiento inválida para huésped {i+1}.")
    if errors:
        return jsonify({"errors": errors}), 400

    # Al menos un adulto
    if not any(g['type'] == 'Adulto' for g in guests):
        return jsonify({"errors": ["Debe haber al menos un adulto en la reserva."]}), 400

    # Buscar hotel y habitación
    hotel = next((h for h in hotels if h['name'] == data['hotel']), None)
    if not hotel:
        return jsonify({"errors": ["Hotel no encontrado."]}), 400
    room = next((r for r in hotel['rooms'] if r['type'] == data['room_type']), None)
    if not room:
        return jsonify({"errors": ["Tipo de habitación no encontrado."]}), 400

    # Validar capacidad
    cap = room['capacity']
    count = {"Adulto": 0, "Niño": 0, "Bebé": 0}
    for g in guests:
        if g['type'] in count:
            count[g['type']] += 1
    if count['Adulto'] > cap['adults'] or count['Niño'] > cap['children'] or count['Bebé'] > cap['babies']:
        return jsonify({"errors": ["La cantidad de huéspedes excede la capacidad de la habitación seleccionada."]}), 400

    # Calcular noches
    d_checkin = parse_date(data['checkin'])
    d_checkout = parse_date(data['checkout'])
    if not d_checkin or not d_checkout or d_checkout <= d_checkin:
        return jsonify({"errors": ["Fechas inválidas."]}), 400
    nights = (d_checkout - d_checkin).days

    # Calcular precio
    price_adult = room['price']
    price_child = price_adult * 0.5
    price_baby = 0
    offer_name = None
    for offer in hotel.get('offers', []):
        o_start = parse_date(offer['start'])
        o_end = parse_date(offer['end'])
        if o_start and o_end and d_checkin >= o_start and d_checkout <= o_end:
            if 'children_discount' in offer:
                price_child = price_adult * (1 - offer['children_discount'])
                offer_name = offer['name']
    subtotal = price_adult * count['Adulto'] + price_child * count['Niño'] + price_baby * count['Bebé']
    total = subtotal * nights

    # Generar código de confirmación
    code = generate_confirmation_code()

    # Respuesta
    return jsonify({
        "confirmation_code": code,
        "hotel": hotel['name'],
        "room_type": room['type'],
        "checkin": data['checkin'],
        "checkout": data['checkout'],
        "nights": nights,
        "guests": guests,
        "price_detail": {
            "subtotal": subtotal,
            "nights": nights,
            "adultos": count['Adulto'],
            "niños": count['Niño'],
            "bebés": count['Bebé'],
            "tarifa_adulto": price_adult,
            "tarifa_niño": price_child,
            "tarifa_bebé": price_baby,
            "oferta": offer_name
        },
        "total": total
    })
from flask import Flask, request, jsonify
from flask_cors import CORS

import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

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
