import html
import logging
import smtplib
from email.message import EmailMessage

import config
from gmail_service import send_email_gmail

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, otp: str) -> None:
    """Send OTP email using Gmail API (primary) with SMTP fallback.

    Flow:
        1. Try Gmail API first
        2. If Gmail API succeeds → done
        3. If Gmail API fails → try existing SMTP
        4. If SMTP succeeds → done
        5. If both fail → raise RuntimeError
    """
    subject = "Verify Your Email | DR Healthcare"
    html_body = _build_html_email(otp)
    plain_body = (
        f"DR Healthcare\n\n"
        f"Your verification code is:\n\n"
        f"{otp}\n\n"
        f"This code expires in 5 minutes.\n\n"
        f"If you didn't request this email, simply ignore it.\n\n"
        f"© DR Healthcare"
    )

    # ── PRIMARY: Gmail API ──
    logger.info("[EMAIL] Attempting to send OTP to %s via Gmail API...", to_email)
    gmail_success = send_email_gmail(
        to_email=to_email,
        subject=subject,
        plain_text=plain_body,
        html_content=html_body,
    )

    if gmail_success:
        logger.info("[EMAIL] OTP delivered to %s via Gmail API.", to_email)
        return

    # ── FALLBACK: SMTP ──
    logger.warning("[EMAIL] Gmail API failed for %s — falling back to SMTP.", to_email)
    _send_otp_email_smtp(to_email, otp, subject, plain_body, html_body)


def _send_otp_email_smtp(
    to_email: str,
    otp: str,
    subject: str,
    plain_body: str,
    html_body: str,
) -> None:
    """Send OTP email via standard SMTP (fallback)."""
    smtp_host = config.SMTP_HOST
    smtp_port = config.SMTP_PORT
    smtp_user = config.SMTP_USER
    smtp_password = config.SMTP_PASSWORD
    sender_email = config.EMAIL_FROM

    logger.info("[SMTP] Preparing to send email to %s", to_email)

    if not smtp_user or not smtp_password:
        logger.warning("[SMTP NOT CONFIGURED] Cannot send OTP to %s via SMTP either.", to_email)
        raise RuntimeError(
            "Both Gmail API and SMTP are unavailable. "
            "Configure Gmail API (run gmail_auth.py) or set SMTP_USER and SMTP_PASSWORD."
        )

    msg = EmailMessage()
    msg["From"] = f"DR Healthcare <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text fallback
    msg.set_content(plain_body)

    # HTML content
    msg.add_alternative(html_body, subtype="html")

    logger.info("[SMTP] Connecting to %s:%s", smtp_host, smtp_port)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        logger.info("[EMAIL SENT] OTP delivered to %s via SMTP fallback.", to_email)
    except Exception as exc:
        logger.exception("[EMAIL FAILED] Both Gmail API and SMTP failed for %s.", to_email)
        raise RuntimeError(
            "Email delivery failed. Both Gmail API and SMTP encountered errors."
        ) from exc



def send_account_notification_email(to_email: str, subject: str, message: str) -> None:
    """Best-effort transactional account email using Gmail API then SMTP.

    Unlike OTP delivery, callers may catch RuntimeError when email is unavailable
    so the underlying account action is not rolled back.
    """
    safe_subject = html.escape(subject)
    safe_message = html.escape(message).replace("\n", "<br>")
    html_body = f"""<!DOCTYPE html>
<html><head><meta charset=\"UTF-8\"></head>
<body style=\"font-family:Arial,sans-serif;background:#f4f8fc;padding:30px;\">
<div style=\"max-width:620px;margin:auto;background:white;border-radius:16px;padding:28px;\">
<h2 style=\"color:#0F766E;\">EyeCare AI</h2>
<h3>{safe_subject}</h3>
<p style=\"color:#425466;line-height:1.7;\">{safe_message}</p>
<p style=\"color:#7b8794;font-size:13px;\">Sign in to EyeCare AI to review the latest account status.</p>
</div></body></html>"""
    if send_email_gmail(
        to_email=to_email,
        subject=subject,
        plain_text=message,
        html_content=html_body,
    ):
        return

    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        raise RuntimeError("Email delivery is not configured")

    msg = EmailMessage()
    msg["From"] = f"EyeCare AI <{config.EMAIL_FROM}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(message)
    msg.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        raise RuntimeError("Account notification email delivery failed") from exc

def _build_html_email(otp: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 15px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(0,0,0,.08);">
<tr><td align="center" style="background:#2563EB;padding:35px;">
<h1 style="margin:0;color:white;">DR Healthcare</h1>
<p style="color:#DBEAFE;">Retinal Disease Detection Platform</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1E3A8A;">Verify Your Email</h2>
<p style="font-size:16px;color:#555;line-height:1.8;">Use the verification code below to continue your registration.</p>
<div style="background:#EEF4FF;border:2px dashed #2563EB;padding:25px;border-radius:15px;text-align:center;margin:35px 0;">
<p style="margin:0;color:#666;">Verification Code</p>
<h1 style="font-size:46px;letter-spacing:12px;margin:15px 0;color:#2563EB;">{otp}</h1>
</div>
<p style="color:#666;">This code expires in 5 minutes. Never share this OTP with anyone.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""