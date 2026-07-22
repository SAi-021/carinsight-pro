"""
Database models (SQLAlchemy ORM).
Tables: users, predictions, resale_logs, recommendations,
finance_logs, wishlists, model_metrics.
"""

from sqlalchemy import (
    Column, Integer, String, Float, Text,
    DateTime, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    email      = Column(String(150), unique=True, index=True, nullable=False)
    password   = Column(String(255), nullable=False)   # bcrypt hash
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active  = Column(Boolean, default=True)

    predictions     = relationship("Prediction",    back_populates="user")
    recommendations = relationship("Recommendation", back_populates="user")
    finance_logs    = relationship("FinanceLog",    back_populates="user")
    wishlists       = relationship("Wishlist",      back_populates="user")


class Prediction(Base):
    __tablename__ = "predictions"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)

    brand           = Column(String(50))
    brand_model     = Column(String(100))
    year            = Column(Integer)
    km_driven       = Column(Float)
    fuel            = Column(String(20))
    transmission    = Column(String(20))
    owner           = Column(Integer)
    seller_type     = Column(String(30))

    predicted_price = Column(Float)
    model_used      = Column(String(50))
    confidence      = Column(String(20))
    fallback_level  = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="predictions")


class ResaleLog(Base):
    __tablename__ = "resale_logs"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)

    brand            = Column(String(50))
    brand_model      = Column(String(100))
    year             = Column(Integer)
    km_driven        = Column(Float)
    fuel             = Column(String(20))
    mileage          = Column(Float)
    condition        = Column(String(30))
    accident         = Column(String(5))
    owner            = Column(Integer)
    selling_type     = Column(String(30))
    transmission     = Column(String(20))
    fitness_status   = Column(String(20))
    purchase_price   = Column(Float)
    current_price    = Column(Float)

    ml_price         = Column(Float)
    rule_price       = Column(Float)
    final_price      = Column(Float)
    scrap_value      = Column(Float)
    car_age          = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Recommendation(Base):
    __tablename__ = "recommendations"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)

    budget     = Column(Float)
    purpose    = Column(String(30))
    seats      = Column(Integer)
    fuel_pref  = Column(String(20))

    results    = Column(JSON)   # the recommended cars, stored as JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="recommendations")


class FinanceLog(Base):
    __tablename__ = "finance_logs"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)

    car_price      = Column(Float)
    down_payment   = Column(Float)
    interest_rate  = Column(Float)
    tenure_months  = Column(Integer)
    cash_discount  = Column(Float)

    monthly_emi    = Column(Float)
    total_interest = Column(Float)
    total_payment  = Column(Float)
    cash_price     = Column(Float)
    decision       = Column(String(30))   # 'cash' or 'finance'
    savings        = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="finance_logs")


class Wishlist(Base):
    __tablename__ = "wishlists"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)

    brand       = Column(String(50))
    brand_model = Column(String(100))
    year        = Column(Integer)
    fuel        = Column(String(20))
    km_driven   = Column(Float)
    price       = Column(Float)
    notes       = Column(Text, nullable=True)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="wishlists")


class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id          = Column(Integer, primary_key=True, index=True)
    model_name  = Column(String(50), unique=True)
    mae         = Column(Float)
    mse         = Column(Float)
    rmse        = Column(Float)
    r2_score    = Column(Float)
    r2_train    = Column(Float)
    cv_r2_mean  = Column(Float)
    cv_r2_std   = Column(Float)
    is_best     = Column(Boolean, default=False)
    trained_at  = Column(DateTime(timezone=True), server_default=func.now())