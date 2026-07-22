"""
App configuration — admin accounts and email (SMTP) settings.
Edit the values below to set who is an admin and which email account
sends password-reset mails.
"""

import os


# Any user whose email is in this list is treated as an admin (compared in lowercase).
ADMIN_EMAILS = [
    "carinsightpro21@gmail.com",
    "admin@carinsight.com",
]


def is_admin_email(email: str) -> bool:
    if not email:
        return False
    return email.lower().strip() in [e.lower().strip() for e in ADMIN_EMAILS]


# SMTP settings for sending password-reset emails.
# For Gmail: turn on 2-Step Verification, then create an App Password
# (Google Account → Security → App passwords) and use that 16-char code.
# Values can also be overridden with environment variables.
SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))           # 587 = TLS, 465 = SSL
SMTP_USER     = os.getenv("SMTP_USER",     "carinsightpro21@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "jcovrotgfhpgebme")
SMTP_USE_TLS  = os.getenv("SMTP_USE_TLS",  "true").lower() == "true"

EMAIL_FROM_NAME    = os.getenv("EMAIL_FROM_NAME",    "CarInsight Pro")
EMAIL_FROM_ADDRESS = os.getenv("EMAIL_FROM_ADDRESS", SMTP_USER)


def email_is_configured() -> bool:
    # Returns False while SMTP still holds placeholder values, so the app
    # can fall back to showing the new password on screen during a demo.
    placeholder_user = SMTP_USER in ("", "youremail@gmail.com")
    placeholder_pass = SMTP_PASSWORD in ("", "your-16-char-app-password")
    return not (placeholder_user or placeholder_pass)