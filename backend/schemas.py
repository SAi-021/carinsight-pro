"""
Pydantic schemas — request validation and response shapes for the API.
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class FuelType(str, Enum):
    petrol   = "petrol"
    diesel   = "diesel"
    cng      = "cng"
    lpg      = "lpg"
    electric = "electric"

class TransmissionType(str, Enum):
    manual    = "manual"
    automatic = "automatic"

class SellerType(str, Enum):
    individual       = "individual"
    dealer           = "dealer"
    trustmark_dealer = "trustmark dealer"

class ConditionType(str, Enum):
    excellent  = "Excellent"
    good       = "Good"
    average    = "Average"
    poor       = "Poor"
    accidented = "Accidented"

class PurposeType(str, Enum):
    personal   = "Personal"
    taxi       = "Taxi"
    company    = "Company"
    long_drive = "Long Drive"
    off_road   = "Off-road"


# ---- Auth ----
class SignupRequest(BaseModel):
    name     : str       = Field(..., min_length=2,  max_length=100)
    email    : EmailStr
    password : str       = Field(..., min_length=6,  max_length=100)

class LoginRequest(BaseModel):
    email    : EmailStr
    password : str = Field(..., min_length=1)

class TokenResponse(BaseModel):
    access_token : str
    token_type   : str = "bearer"
    user_id      : int
    name         : str
    email        : str
    is_admin     : bool = False

class OtpRequest(BaseModel):
    name     : str       = Field(..., min_length=2,  max_length=100)
    email    : EmailStr
    password : str       = Field(..., min_length=6,  max_length=100)

class OtpVerifyRequest(BaseModel):
    email : EmailStr
    otp   : str = Field(..., min_length=4, max_length=6)

class ForgotPasswordRequest(BaseModel):
    email : EmailStr

class ResetPasswordRequest(BaseModel):
    email        : EmailStr
    otp          : str = Field(..., min_length=4, max_length=6)
    new_password : str = Field(..., min_length=8, max_length=100)


# ---- Price prediction ----
class PredictRequest(BaseModel):
    brand        : str          = Field(..., min_length=2, max_length=50, example="maruti")
    brand_model  : Optional[str]= Field(None, example="maruti swift")
    year         : int          = Field(..., ge=1990, le=2026, example=2019)
    km_driven    : float        = Field(..., ge=0, le=1000000, example=45000)
    fuel         : FuelType     = Field(..., example="petrol")
    transmission : TransmissionType = Field(..., example="manual")
    owner        : int          = Field(..., ge=0, le=4, example=1)
    seller_type  : SellerType   = Field(SellerType.individual)

    @validator('brand', 'brand_model', pre=True)
    def lowercase_strip(cls, v):
        return v.lower().strip() if v else v

class PredictResponse(BaseModel):
    predicted_price      : float
    predicted_price_lakh : float
    model_used           : str
    car_age              : int
    km_per_year          : float
    confidence           : str
    fallback_level       : int
    fallback_message     : str
    resolved_brand       : str


# ---- Resale value ----
class ResaleRequest(BaseModel):
    brand          : str   = Field(..., min_length=2, example="maruti")
    brand_model    : str   = Field(..., min_length=2, example="maruti swift")
    year           : int   = Field(..., ge=1990, le=2026)
    km_driven      : float = Field(..., ge=0,    le=1000000)
    fuel           : FuelType
    mileage        : float = Field(..., ge=1,    le=800,
                                   description="km/l for ICE, km/charge for EV")
    condition      : ConditionType = Field(..., example="Good")
    accident       : str   = Field(..., pattern="^(Yes|No)$")
    owner          : int   = Field(..., ge=0, le=4)
    selling_type   : str   = Field(..., pattern="^(Dealer|Individual)$")
    transmission   : TransmissionType
    fitness_status : str   = Field(..., pattern="^(Valid|Expired)$")
    purchase_price : float = Field(..., gt=0)
    current_price  : float = Field(..., gt=0)

    @validator('brand', 'brand_model', pre=True)
    def lowercase_strip(cls, v):
        return v.lower().strip() if v else v

class ResaleResponse(BaseModel):
    ml_price         : float
    rule_price       : float
    final_price      : float
    final_price_lakh : float
    scrap_value      : float
    car_age          : int
    blend            : str
    factors          : dict


# ---- Recommendation ----
class RecommendRequest(BaseModel):
    budget    : float       = Field(..., gt=0,   example=500000)
    purpose   : PurposeType = Field(...,          example="Personal")
    seats     : int         = Field(..., ge=2, le=9, example=5)
    fuel_pref : Optional[FuelType] = Field(None,  example="petrol")

class CarResult(BaseModel):
    brand        : str
    brand_model  : str
    year         : int
    fuel         : str
    km_driven    : float
    selling_price: float
    selling_price_lakh : float
    score        : float
    reason       : str

class RecommendResponse(BaseModel):
    total_found : int
    budget_lakh : float
    cars        : List[CarResult]
    warning     : Optional[str] = None
    dataset_max : Optional[float] = None
    used_filter : Optional[str] = None


# ---- Finance decision ----
class FinanceRequest(BaseModel):
    car_price       : float = Field(..., gt=0,        example=600000)
    down_payment    : float = Field(..., ge=0,         example=100000)
    interest_rate   : float = Field(..., gt=0, le=30,  example=9.5,
                                    description="Annual loan rate in percent")
    tenure_months   : int   = Field(..., ge=6,  le=84, example=60)
    cash_discount   : float = Field(2.0, ge=0,  le=20,
                                    description="Cash discount percent (default 2%)")
    investment_rate : float = Field(8.0, ge=0, le=30,
                                    description="Expected annual return if the "
                                                "spare cash were invested instead (default 8%)")

    @validator('down_payment')
    def down_payment_less_than_price(cls, v, values):
        if 'car_price' in values and v >= values['car_price']:
            raise ValueError('Down payment must be less than car price')
        return v

class FinanceResponse(BaseModel):
    loan_amount            : float
    monthly_emi            : float
    total_interest         : float
    total_payment          : float
    cash_price             : float
    cash_discount_pct      : float
    investment_rate        : float
    investment_gain        : float
    effective_finance_cost : float
    decision               : str
    savings                : float
    recommendation         : str


# ---- Dashboard ----
class DashboardResponse(BaseModel):
    total_predictions   : int
    total_users         : int
    avg_predicted_price : float
    price_by_year       : List[dict]
    brand_distribution  : List[dict]
    fuel_distribution   : List[dict]
    best_model          : str
    model_r2            : float
    dataset_size        : Optional[int] = None
    brands_count        : Optional[int] = None
    models_count        : Optional[int] = None
    price_by_fuel         : Optional[List[dict]] = None
    avg_price_by_brand    : Optional[List[dict]] = None
    models_per_brand      : Optional[dict]       = None
    predictions_over_time : Optional[List[dict]] = None
    popular_brands        : Optional[List[dict]] = None


# ---- Model comparison ----
class ModelMetricOut(BaseModel):
    model_name  : str
    mae         : float
    mse         : float
    rmse        : float
    r2_score    : float
    cv_r2_mean  : float
    cv_r2_std   : float
    is_best     : bool

class ModelComparisonResponse(BaseModel):
    best_model : str
    models     : List[ModelMetricOut]


# ---- Wishlist ----
class WishlistAddRequest(BaseModel):
    brand       : str   = Field(..., min_length=2)
    brand_model : str   = Field(..., min_length=2)
    year        : int   = Field(..., ge=1990, le=2026)
    fuel        : FuelType
    km_driven   : float = Field(..., ge=0)
    price       : float = Field(..., gt=0)
    notes       : Optional[str] = None

class WishlistItem(BaseModel):
    id          : int
    brand       : str
    brand_model : str
    year        : int
    fuel        : str
    km_driven   : float
    price       : float
    price_lakh  : float
    notes       : Optional[str]
    created_at  : datetime

    class Config:
        from_attributes = True


# ---- History ----
class PredictionHistoryItem(BaseModel):
    id              : int
    brand           : Optional[str] = None
    brand_model     : Optional[str] = None
    year            : Optional[int] = None
    km_driven       : Optional[float] = None
    fuel            : Optional[str] = None
    predicted_price : Optional[float] = None
    confidence      : Optional[str] = None
    created_at      : datetime

    class Config:
        from_attributes = True


# ---- Common ----
class MessageResponse(BaseModel):
    message : str
    success : bool = True


# ---- Admin ----
class AdminUserItem(BaseModel):
    id              : int
    name            : str
    email           : str
    is_active       : bool
    is_admin        : bool = False
    created_at      : datetime
    predictions     : int = 0
    resale_logs     : int = 0
    recommendations : int = 0
    finance_logs    : int = 0
    wishlists       : int = 0

    class Config:
        from_attributes = True

class AdminStatsResponse(BaseModel):
    total_users        : int
    total_admins       : int
    total_predictions  : int
    total_resale_logs  : int
    total_recommendations : int
    total_finance_logs : int
    total_wishlist     : int
    newest_user_email  : Optional[str] = None
    newest_user_date   : Optional[datetime] = None

class AdminResetPasswordRequest(BaseModel):
    user_id      : int
    new_password : Optional[str] = Field(None, min_length=6, max_length=100)

class AdminResetPasswordResponse(BaseModel):
    message       : str
    success       : bool = True
    email_sent    : bool
    new_password  : Optional[str] = None
    detail        : Optional[str] = None

class AdminClearRequest(BaseModel):
    tables  : List[str] = Field(
        default_factory=lambda: ["predictions", "resale_logs",
                                 "recommendations", "finance_logs", "wishlists"]
    )
    confirm : str = Field(..., description="Must equal 'DELETE' to proceed")

class AdminClearResponse(BaseModel):
    message       : str
    success       : bool = True
    deleted       : dict

class AdminClearUserRequest(BaseModel):
    user_id : int
    tables  : List[str] = Field(
        default_factory=lambda: ["predictions", "resale_logs",
                                 "recommendations", "finance_logs", "wishlists"]
    )
    # confirm (== 'DELETE') is only required when clearing all five types
    confirm : Optional[str] = None