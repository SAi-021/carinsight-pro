"""
Database connection setup (MySQL via SQLAlchemy).
Note: this MySQL instance runs on IPv6 [::1] port 1306, not the usual 3306.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

try:
    from sqlalchemy.orm import declarative_base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base

DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_NAME     = os.getenv("DB_NAME",     "carinsight_pro")


def _make_engine():
    # Try each host/port variant until one connects. The first (IPv6 :1306)
    # is what this setup actually uses; the rest are fallbacks.
    attempts = [
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@[::1]:1306/{DB_NAME}?charset=utf8mb4",
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@127.0.0.1:1306/{DB_NAME}?charset=utf8mb4",
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@localhost:1306/{DB_NAME}?charset=utf8mb4",
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@127.0.0.1:3306/{DB_NAME}?charset=utf8mb4",
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@[::1]:3306/{DB_NAME}?charset=utf8mb4",
    ]
    labels = [
        "IPv6 [::1]:1306", "IPv4 127.0.0.1:1306", "localhost:1306",
        "IPv4 127.0.0.1:3306", "IPv6 [::1]:3306",
    ]

    for url, label in zip(attempts, labels):
        try:
            eng = create_engine(
                url,
                pool_pre_ping=True,
                pool_recycle=3600,
                pool_timeout=5,
                connect_args={"connect_timeout": 3},
                echo=False,
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[INFO] MySQL connected -> {label}")
            return eng
        except Exception as e:
            print(f"[WARN] {label} failed: {str(e)[:70]}")
            continue

    print("[ERROR] All MySQL connection attempts failed.")
    # Return the first engine anyway so the server can still start.
    return create_engine(attempts[0], pool_pre_ping=True, echo=False)


engine       = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()