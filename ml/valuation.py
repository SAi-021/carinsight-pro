"""
Hybrid resale valuation engine.

Blends an ML price prediction (60%) with a rule-based depreciation model (40%).
The rule model multiplies a base price by factors for age, mileage, fuel,
condition, accidents, owner count, seller type, brand retention, and fitness —
calibrated to Indian used-car market patterns (CarDekho / Cars24 / OLX style).
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from predictor import predict_price

CURRENT_YEAR = 2026

# Owner-count resale multipliers. First owner is the baseline (1.00); each
# extra owner drops the value, based on Indian used-car market patterns.
OWNER_FACTOR_MAP = {
    0: 0.82,   # Test Drive Car — unknown usage, no service history
    1: 1.00,   # First Owner    — best resale
    2: 0.88,   # Second Owner   — ~12% drop
    3: 0.78,   # Third Owner    — ~22% drop
    4: 0.65,   # Fourth & above — ~35% drop
}

# Fuel-type resale multipliers (diesel/EV hold value better in India).
FUEL_FACTOR_MAP = {
    'petrol'  : 1.00,
    'diesel'  : 1.15,
    'cng'     : 0.85,
    'lpg'     : 0.80,
    'electric': 1.25,
}

CONDITION_FACTOR_MAP = {
    'excellent' : 1.20,
    'good'      : 1.00,
    'average'   : 0.82,
    'poor'      : 0.62,
    'accidented': 0.50,
}

# How well each brand retains value (Toyota/Maruti high; luxury lower due to
# maintenance cost).
BRAND_FACTOR_MAP = {
    'toyota'    : 1.20,
    'maruti'    : 1.12,
    'hyundai'   : 1.10,
    'honda'     : 1.08,
    'tata'      : 1.05,
    'mahindra'  : 1.05,
    'kia'       : 1.03,
    'volkswagen': 1.00,
    'skoda'     : 0.98,
    'ford'      : 0.95,
    'renault'   : 0.93,
    'nissan'    : 0.92,
    'chevrolet' : 0.90,
    'bmw'       : 0.88,
    'audi'      : 0.85,
    'mercedes'  : 0.87,
    'jeep'      : 0.92,
}


def _get_owner_factor(owner: int) -> tuple:
    # Return (factor, explanation) for the owner count (0=test drive .. 4=fourth+).
    owner = max(0, min(owner, 4))
    factor = OWNER_FACTOR_MAP.get(owner, 0.65)

    explanations = {
        0: "Test Drive Car — high penalty due to unknown usage history",
        1: "First Owner — no penalty, best resale value",
        2: "Second Owner — 12% reduction in resale value",
        3: "Third Owner — 22% reduction, raises reliability concerns",
        4: "Fourth+ Owner — 35% reduction, heavily penalised by market",
    }
    return factor, explanations.get(owner, "Unknown owner count")


def _get_age_factor(age: int) -> float:
    # Depreciation by age — steepest in the first three years.
    if age <= 1:   return 0.85
    if age <= 3:   return 0.72
    if age <= 5:   return 0.58
    if age <= 7:   return 0.48
    if age <= 10:  return 0.38
    if age <= 12:  return 0.30
    if age <= 15:  return 0.22
    return 0.15


def _get_km_factor(kms: float) -> float:
    # Mileage penalty. ~12-15k km/year is considered normal.
    if kms < 15000:   return 1.05
    if kms < 30000:   return 1.00
    if kms < 60000:   return 0.92
    if kms < 80000:   return 0.85
    if kms < 120000:  return 0.75
    if kms < 150000:  return 0.65
    return 0.55


def _get_mileage_factor(fuel: str, mileage: float) -> float:
    # Fuel-efficiency factor. For electric, mileage = range per charge (km).
    if fuel == 'electric':
        if mileage < 150:   return 0.80
        if mileage < 300:   return 1.00
        return 1.20
    else:
        if mileage < 10:    return 0.75
        if mileage < 15:    return 0.90
        if mileage < 20:    return 1.00
        return 1.10


def _get_fitness_factor(age: int, fitness_status: str) -> float:
    # Fitness certificate matters most for vehicles over 15 years old.
    if age > 15:
        return 0.40 if fitness_status == 'Expired' else 0.70
    if age > 10:
        return 0.88
    return 1.00


def calculate_resale_value(
    purchase_price : float,
    current_price  : float,
    year           : int,
    kms            : float,
    fuel           : str,
    mileage        : float,
    accident       : str,   # "Yes" or "No"
    condition      : str,   # Excellent / Good / Average / Poor / Accidented
    owner          : int,   # 0=TestDrive, 1=First, 2=Second, 3=Third, 4=Fourth+
    selling_type   : str,   # "Dealer" or "Individual"
    brand          : str,
    model_name     : str,
    transmission   : str,   # "Manual" or "Automatic"
    fitness_status : str,   # "Valid" or "Expired"
) -> tuple:
    """
    Compute the resale value.

    rule_price = base × all the individual factors
    final_price = 0.60 × ml_price + 0.40 × rule_price

    Returns (final_price, scrap_value, car_age, breakdown_dict).
    """
    if purchase_price <= 0 or current_price <= 0:
        return 0, 0, 0, {'error': 'Invalid price inputs'}

    fuel         = fuel.lower().strip()
    transmission = transmission.lower().strip()
    condition    = condition.lower().strip()
    brand        = brand.lower().strip()

    age  = max(CURRENT_YEAR - year, 1)
    base = (purchase_price * 0.30) + (current_price * 0.70)

    age_factor          = _get_age_factor(age)
    km_factor           = _get_km_factor(kms)
    fuel_factor         = FUEL_FACTOR_MAP.get(fuel, 1.00)
    mileage_factor      = _get_mileage_factor(fuel, mileage)
    transmission_factor = 1.15 if transmission == 'automatic' else 1.00
    condition_factor    = CONDITION_FACTOR_MAP.get(condition, 1.00)
    accident_factor     = 0.72 if accident == 'Yes' else 1.00
    owner_factor, owner_note = _get_owner_factor(owner)
    selling_factor      = 0.87 if selling_type == 'Dealer' else 1.08
    brand_factor        = BRAND_FACTOR_MAP.get(brand, 1.00)
    fitness_factor      = _get_fitness_factor(age, fitness_status)

    rule_price = (
        base
        * age_factor
        * km_factor
        * fuel_factor
        * mileage_factor
        * transmission_factor
        * condition_factor
        * accident_factor
        * owner_factor
        * selling_factor
        * brand_factor
        * fitness_factor
    )

    # ML price; if the model can't run for any reason, fall back to rule price.
    try:
        ml_result = predict_price(
            brand        = brand,
            year         = year,
            km_driven    = kms,
            fuel         = fuel,
            transmission = transmission,
            owner        = owner,
        )
        ml_price = ml_result['predicted_price']
        ml_available = True
    except Exception:
        ml_price      = rule_price
        ml_available  = False

    if ml_available:
        final = (0.60 * ml_price) + (0.40 * rule_price)
    else:
        final = rule_price

    # Keep the estimate sensible: at most 95% of current price, at least 3%.
    final = min(final, current_price * 0.95)
    final = max(final, current_price * 0.03)

    scrap = max(50000, current_price * 0.01)

    breakdown = {
        'base_price'          : round(base, 0),
        'ml_price'            : round(ml_price, 0),
        'rule_price'          : round(rule_price, 0),
        'final_price'         : round(final, 0),
        'scrap_value'         : round(scrap, 0),
        'car_age_years'       : age,
        'factors': {
            'age_factor'          : round(age_factor, 3),
            'km_factor'           : round(km_factor, 3),
            'fuel_factor'         : round(fuel_factor, 3),
            'mileage_factor'      : round(mileage_factor, 3),
            'transmission_factor' : round(transmission_factor, 3),
            'condition_factor'    : round(condition_factor, 3),
            'accident_factor'     : round(accident_factor, 3),
            'owner_factor'        : round(owner_factor, 3),
            'owner_note'          : owner_note,
            'selling_factor'      : round(selling_factor, 3),
            'brand_factor'        : round(brand_factor, 3),
            'fitness_factor'      : round(fitness_factor, 3),
        },
        'ml_used'             : ml_available,
        'blend'               : '60% ML + 40% Rule' if ml_available else '100% Rule-based',
    }

    return final, scrap, age, breakdown


if __name__ == '__main__':
    print("=" * 60)
    print("  OWNER FACTOR IMPACT TEST — Same car, different owners")
    print("=" * 60)

    base_args = dict(
        purchase_price=700000, current_price=600000,
        year=2019, kms=55000, fuel='Petrol', mileage=17,
        accident='No', condition='Good',
        selling_type='Individual', brand='Maruti',
        model_name='Swift', transmission='Manual',
        fitness_status='Valid'
    )

    owner_labels = {
        0: 'Test Drive Car',
        1: 'First Owner    ',
        2: 'Second Owner   ',
        3: 'Third Owner    ',
        4: 'Fourth+ Owner  ',
    }

    for owner_val, label in owner_labels.items():
        price, scrap, age, breakdown = calculate_resale_value(
            **base_args, owner=owner_val
        )
        factor = breakdown['factors']['owner_factor']
        note   = breakdown['factors']['owner_note']
        print(f"  owner={owner_val} ({label}) | factor={factor:.2f} | "
              f"Resale=₹{price:>9,.0f}  | {note}")

    print("=" * 60)