"""
Email helpers — sends mail via SMTP using the settings in config.py.
If SMTP isn't configured, every function returns (False, reason) instead
of crashing, so the rest of the app keeps working.
"""

import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config


def _send(to_email: str, subject: str, text_body: str, html_body: str):
    # Actually delivers one message. Returns (sent, detail).
    if not config.email_is_configured():
        return (False, "SMTP not configured in config.py — email skipped.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{config.EMAIL_FROM_NAME} <{config.EMAIL_FROM_ADDRESS}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if config.SMTP_PORT == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, context=ctx) as s:
                s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.sendmail(config.EMAIL_FROM_ADDRESS, to_email, msg.as_string())
        else:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as s:
                if config.SMTP_USE_TLS:
                    s.starttls(context=ssl.create_default_context())
                s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.sendmail(config.EMAIL_FROM_ADDRESS, to_email, msg.as_string())
        return (True, f"Email sent to {to_email}")
    except Exception as e:
        return (False, f"Email send failed: {str(e)[:200]}")


def _wrap(title: str, body_html: str) -> str:
    # Shared HTML shell so every email has the same header/footer styling.
    return f"""\
<html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;background:#f3f4f6;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="background:#0d1017;padding:22px 30px;">
      <h1 style="margin:0;color:#f0a500;font-size:24px;letter-spacing:0.04em;">CarInsight&nbsp;Pro</h1>
      <div style="color:#8892a4;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-top:4px;">{title}</div>
    </div>
    <div style="padding:28px 30px;">
      {body_html}
    </div>
    <div style="padding:16px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
      Sent by CarInsight Pro · ML-powered used car insights
    </div>
  </div>
</body></html>"""


# Sent on signup
def send_welcome_email(to_email: str, to_name: str):
    subject = "Welcome to CarInsight Pro 🎉"

    text_body = (
        f"Hello {to_name},\n\n"
        "Welcome to CarInsight Pro!\n\n"
        "Your account has been created successfully. You can now log in and start "
        "using all our features:\n"
        "  • ML-powered price predictions\n"
        "  • Hybrid resale valuations\n"
        "  • Personalised car recommendations\n"
        "  • Cash vs finance comparison\n"
        "  • Personal wishlist + history\n\n"
        "If you didn't create this account, please contact the administrator.\n\n"
        "— The CarInsight Pro Team"
    )

    html_body = _wrap("Account created", f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>Welcome to <strong style="color:#f0a500;">CarInsight Pro</strong> — your account has been created successfully.</p>
      <p>You can now log in and start using all our features:</p>
      <ul style="margin:14px 0 18px;padding-left:22px;">
        <li>ML-powered price predictions</li>
        <li>Hybrid resale valuations</li>
        <li>Personalised car recommendations</li>
        <li>Cash vs finance comparison</li>
        <li>Personal wishlist and prediction history</li>
      </ul>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        If you didn't create this account, please contact the administrator immediately.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)


# Sent when an admin resets a user's password
def send_password_email(to_email: str, to_name: str, new_password: str):
    subject = "Your CarInsight Pro password has been reset"

    text_body = (
        f"Hello {to_name},\n\n"
        "An administrator has reset your CarInsight Pro password.\n\n"
        f"    New password: {new_password}\n\n"
        "Please log in with this password and change it as soon as possible.\n\n"
        "If you did not expect this email, contact the administrator.\n\n"
        "— The CarInsight Pro Team"
    )

    html_body = _wrap("Password reset", f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>An administrator has reset your CarInsight Pro password.</p>
      <p style="margin:24px 0;">
        <span style="display:inline-block;background:#fef3c7;border:1px solid #f0a500;border-radius:8px;padding:14px 22px;font-size:18px;font-weight:bold;letter-spacing:1px;color:#1f2937;font-family:monospace;">
          {new_password}
        </span>
      </p>
      <p>Please log in with this password and change it as soon as possible.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        If you did not expect this email, contact the administrator.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)


# Sent when an admin deletes a user account
def send_account_deleted_email(to_email: str, to_name: str):
    subject = "Your CarInsight Pro account has been deleted"

    text_body = (
        f"Hello {to_name},\n\n"
        "We're writing to let you know that your CarInsight Pro account has been "
        "deleted by an administrator. All of your data (predictions, resale logs, "
        "recommendations, finance logs, and wishlist items) has been permanently "
        "removed.\n\n"
        "If you believe this was a mistake, please contact the administrator.\n\n"
        "You are welcome to sign up again at any time.\n\n"
        "— The CarInsight Pro Team"
    )

    html_body = _wrap("Account deleted", f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>We're writing to let you know that your CarInsight Pro account has been
      <strong style="color:#ef4444;">deleted</strong> by an administrator.</p>
      <p>All of your data — predictions, resale logs, recommendations, finance logs,
      and wishlist items — has been permanently removed.</p>
      <p>If you believe this was a mistake, please contact the administrator.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        You are welcome to sign up again at any time.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)


# Sent when an admin sets a specific password for a user
def send_password_set_email(to_email: str, to_name: str, new_password: str):
    subject = "Your CarInsight Pro password has been changed"

    text_body = (
        f"Hello {to_name},\n\n"
        "An administrator has set a new password for your CarInsight Pro account.\n\n"
        f"    New password: {new_password}\n\n"
        "Please log in with this password and change it as soon as possible.\n\n"
        "If you did not expect this email, contact the administrator.\n\n"
        "— The CarInsight Pro Team"
    )

    html_body = _wrap("Password changed", f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>An administrator has set a new password for your CarInsight Pro account.</p>
      <p style="margin:24px 0;">
        <span style="display:inline-block;background:#fef3c7;border:1px solid #f0a500;border-radius:8px;padding:14px 22px;font-size:18px;font-weight:bold;letter-spacing:1px;color:#1f2937;font-family:monospace;">
          {new_password}
        </span>
      </p>
      <p>Please log in with this password and change it as soon as possible.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        If you did not expect this email, contact the administrator.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)


# Sent when an admin clears specific activity data for a user
def send_data_cleared_email(to_email: str, to_name: str, cleared: dict):
    label_map = {
        "predictions"     : "Price predictions",
        "resale_logs"     : "Resale valuations",
        "recommendations" : "Recommendations",
        "finance_logs"    : "Finance calculations",
        "wishlists"       : "Wishlist items",
    }
    lines = []
    for key, count in (cleared or {}).items():
        if isinstance(count, int) and count > 0:
            lines.append((label_map.get(key, key), count))

    if not lines:
        return (False, "No data was cleared; email skipped.")

    subject = "Some of your CarInsight Pro data was cleared"

    text_lines = "\n".join([f"  • {lbl}: {cnt} removed" for lbl, cnt in lines])
    text_body = (
        f"Hello {to_name},\n\n"
        "An administrator has cleared some of your CarInsight Pro activity data:\n\n"
        f"{text_lines}\n\n"
        "Your account itself is still active — only the items above were removed.\n\n"
        "If you believe this was a mistake, please contact the administrator.\n\n"
        "— The CarInsight Pro Team"
    )

    html_rows = "".join([
        f'<li><strong>{lbl}</strong>: {cnt} removed</li>' for lbl, cnt in lines
    ])
    html_body = _wrap("Data cleared", f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>An administrator has cleared some of your CarInsight Pro activity data:</p>
      <ul style="margin:14px 0 18px;padding-left:22px;">
        {html_rows}
      </ul>
      <p>Your account itself is still active — only the items above were removed.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        If you believe this was a mistake, please contact the administrator.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)


# Sent during signup to verify the email address
def send_otp_email(to_email: str, otp_code: str, minutes: int = 5):
    subject = "Your CarInsight Pro verification code"

    text_body = (
        "Hello,\n\n"
        "Your CarInsight Pro email verification code is:\n\n"
        f"    {otp_code}\n\n"
        f"This code is valid for {minutes} minutes. Enter it on the signup page "
        "to complete creating your account.\n\n"
        "If you didn't request this, you can safely ignore this email.\n\n"
        "— The CarInsight Pro Team"
    )

    html_body = _wrap("Verify your email", f"""
      <p>Hello,</p>
      <p>Your CarInsight Pro email verification code is:</p>
      <p style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;background:#fef3c7;border:1px solid #f0a500;border-radius:10px;padding:16px 30px;font-size:32px;font-weight:bold;letter-spacing:10px;color:#1f2937;font-family:monospace;">
          {otp_code}
        </span>
      </p>
      <p>This code is valid for <strong>{minutes} minutes</strong>. Enter it on the signup
      page to complete creating your account.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    """)

    return _send(to_email, subject, text_body, html_body)