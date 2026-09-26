"""
Gmail OAuth 2.0 Authorization Script

Run this script ONCE to authorize your Gmail account and generate token.json.
The FastAPI server must NOT be running on port 8000 when you run this.

Usage:
    python gmail_auth.py
"""

import json
import sys
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from google_auth_oauthlib.flow import Flow

# Only the Gmail send scope — no read access
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# Must match EXACTLY what is registered in Google Cloud Console
REDIRECT_URI = "http://localhost:8000/oauth2callback"

# Paths relative to this script
_BASE_DIR = Path(__file__).parent
CREDENTIALS_FILE = _BASE_DIR / "credentials.json"
TOKEN_FILE = _BASE_DIR / "token.json"


class _OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Handles the OAuth2 callback on /oauth2callback."""

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path != "/oauth2callback":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        # Extract the authorization code from the query string
        query_params = parse_qs(parsed.query)

        if "error" in query_params:
            error = query_params["error"][0]
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                f"<h2>Authorization Failed</h2><p>Error: {error}</p>".encode()
            )
            self.server.auth_code = None
            self.server.auth_error = error
            return

        if "code" not in query_params:
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h2>Missing authorization code</h2>")
            self.server.auth_code = None
            self.server.auth_error = "Missing authorization code"
            return

        self.server.auth_code = query_params["code"][0]
        self.server.auth_error = None

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<h2>Authorization complete!</h2>"
            b"<p>You can close this tab and return to the terminal.</p>"
        )

    def log_message(self, format, *args):
        """Suppress default HTTP server logs."""
        pass


def main():
    # ── Validate credentials.json exists and is valid ──
    if not CREDENTIALS_FILE.exists():
        print(f"ERROR: {CREDENTIALS_FILE} not found.")
        print("Place your Google OAuth 2.0 Web Application credentials file here.")
        sys.exit(1)

    try:
        with open(CREDENTIALS_FILE, "r") as f:
            creds_data = json.load(f)
    except json.JSONDecodeError:
        print(f"ERROR: {CREDENTIALS_FILE} is not valid JSON.")
        sys.exit(1)

    # Verify it contains a web client configuration
    if "web" not in creds_data:
        print(f"ERROR: {CREDENTIALS_FILE} does not contain a 'web' client configuration.")
        print("Ensure you downloaded the OAuth 2.0 Web Application credentials from Google Cloud Console.")
        sys.exit(1)

    web_config = creds_data["web"]
    client_id = web_config.get("client_id", "(missing)")
    project_id = web_config.get("project_id", "(unknown)")
    json_redirect_uris = web_config.get("redirect_uris", [])

    print("=" * 60)
    print("Gmail OAuth 2.0 Authorization")
    print("=" * 60)
    print(f"  credentials.json: VALID")
    print(f"  Project ID:       {project_id}")
    print(f"  Client ID:        {client_id}")
    print(f"  Redirect URIs in JSON: {json_redirect_uris}")
    print(f"  Redirect URI used:     {REDIRECT_URI}")
    print()

    # Warn if there's a mismatch between the JSON and what we'll use
    if REDIRECT_URI not in json_redirect_uris:
        print(f"WARNING: '{REDIRECT_URI}' is NOT listed in credentials.json redirect_uris!")
        print(f"  credentials.json has: {json_redirect_uris}")
        print("  This may cause a redirect_uri_mismatch error from Google.")
        print()

    # ── Build the OAuth flow using the base Flow class ──
    # We use Flow (not InstalledAppFlow) because InstalledAppFlow.run_local_server()
    # overrides the redirect_uri to 'http://localhost:{port}/' which does NOT match
    # the registered redirect URI 'http://localhost:8000/oauth2callback'.
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # Generate the authorization URL
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )

    print("Opening browser for Gmail authorization...")
    print()
    print(f"If the browser doesn't open, visit this URL manually:")
    print(f"  {auth_url}")
    print()

    # Open the browser
    webbrowser.open(auth_url)

    # ── Start local server to receive the callback ──
    print(f"Waiting for OAuth callback on {REDIRECT_URI} ...")
    print()

    server = HTTPServer(("localhost", 8000), _OAuthCallbackHandler)
    server.auth_code = None
    server.auth_error = None

    # Handle one request (the OAuth callback)
    server.handle_request()
    server.server_close()

    if server.auth_error or not server.auth_code:
        print(f"ERROR: Authorization failed — {server.auth_error}")
        sys.exit(1)

    # ── Exchange the authorization code for credentials ──
    print("Exchanging authorization code for tokens...")
    flow.fetch_token(code=server.auth_code)
    creds = flow.credentials

    # ── Save the token ──
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())

    print()
    print(f"SUCCESS: OAuth credentials saved to {TOKEN_FILE}")
    print(f"  Refresh token present: {bool(creds.refresh_token)}")
    print()
    print("You can now start your FastAPI server. Gmail API email sending is ready.")


if __name__ == "__main__":
    main()