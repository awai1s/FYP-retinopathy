const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

const LOCAL_API_PORT = "8001";

function resolveApiBaseUrl(): string {
  // Expo Web:
  // - If .env.local provides a non-loopback production/staging URL, keep it.
  // - For local web development, use the same browser host with the dedicated
  //   backend port. This works for localhost, 127.0.0.1, and LAN-hosted Expo Web.
  if (typeof window !== "undefined" && window.location?.hostname) {
    const browserHost = window.location.hostname;

    if (configuredApiUrl) {
      const configured = new URL(configuredApiUrl);
      if (!/^(?:localhost|127\.0\.0\.1)$/i.test(configured.hostname)) return configuredApiUrl;
      const safeHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
      return `${configured.protocol}//${safeHost}:${configured.port || LOCAL_API_PORT}`;
    }

    const safeHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
    return `http://${safeHost}:${LOCAL_API_PORT}`;
  }

  // Native/dev fallback. For a physical phone, set EXPO_PUBLIC_API_URL to the
  // computer's LAN IP, e.g. http://192.168.1.10:8001.
  return configuredApiUrl || `http://127.0.0.1:${LOCAL_API_PORT}`;
}

const BASE_URL = resolveApiBaseUrl();

export default BASE_URL;
