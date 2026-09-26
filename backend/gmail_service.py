"""
Gmail API Email Service Module

Handles sending emails through the Gmail API using OAuth 2.0 credentials.
Automatically refreshes access tokens when they expire.

This module does NOT use SMTP, smtplib, or any third-party email provider.
"""

import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Paths relative to this module
_BASE_DIR = Path(__file__).parent
CREDENTIALS_FILE = _BASE_DIR / "credentials.json"
TOKEN_FILE = _BASE_DIR / "token.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def _get_gmail_credentials() -> Credentials | None:
    """Load and refresh Gmail OAuth credentials from token.json.

    Returns None if token.json is missing or credentials cannot be refreshed.
    Never logs or exposes secret values.
    """
    if not TOKEN_FILE.exists():
        logger.warning("[GMAIL] token.json not found — Gmail API is unavailable.")
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    except Exception:
        logger.exception("[GMAIL] Failed to load token.json.")
        return None

    # Refresh if expired
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Persist the refreshed token
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
            logger.info("[GMAIL] Access token refreshed successfully.")
        except Exception:
            logger.exception("[GMAIL] Failed to refresh access token.")
            return None

    if not creds or not creds.valid:
        logger.warning("[GMAIL] Credentials are not valid after refresh attempt.")
        return None

    return creds


def _build_gmail_service():
    """Build and return a Gmail API service client.

    Returns None if credentials are unavailable.
    """
    creds = _get_gmail_credentials()
    if creds is None:
        return None

    try:
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return service
    except Exception:
        logger.exception("[GMAIL] Failed to build Gmail API service.")
        return None


def send_email_gmail(
    to_email: str,
    subject: str,
    plain_text: str,
    html_content: str,
    sender_name: str = "DR Healthcare",
) -> bool:
    """Send an email through the Gmail API.

    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        plain_text: Plain text body (fallback).
        html_content: HTML body.
        sender_name: Display name for the sender.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    service = _build_gmail_service()
    if service is None:
        logger.warning("[GMAIL] Gmail API service unavailable — cannot send email.")
        return False

    try:
        # Build MIME message
        message = MIMEMultipart("alternative")
        message["To"] = to_email
        message["Subject"] = subject

        # Attach plain text and HTML parts
        message.attach(MIMEText(plain_text, "plain"))
        message.attach(MIMEText(html_content, "html"))

        # Encode to base64url
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        # Send via Gmail API (sender is the authenticated account)
        result = service.users().messages().send(
            userId="me",
            body={"raw": raw_message},
        ).execute()

        message_id = result.get("id", "unknown")
        logger.info("[GMAIL] Email sent successfully to %s (message ID: %s)", to_email, message_id)
        return True

    except Exception:
        logger.exception("[GMAIL] Failed to send email to %s via Gmail API.", to_email)
        return False


def is_gmail_api_available() -> bool:
    """Check whether Gmail API credentials are configured and valid."""
    creds = _get_gmail_credentials()
    return creds is not None and creds.valid