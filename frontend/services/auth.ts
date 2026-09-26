import BASE_URL from "./api";
import {
  saveToken,
  saveUserRole,
} from "./storage";
import type { UserRole } from "./storage";
import { setOfflineOwnerIdentity } from "./offlineCache";

/* ---------------- TIMEOUT HELPER ---------------- */

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
) {
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(
      url,
      {
        ...options,
        signal: controller.signal,
      }
    );

    return response;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }

    const message = String(error?.message || "").toLowerCase();
    if (message.includes("network request failed") || message.includes("failed to fetch") || error instanceof TypeError) {
      throw new Error("Cannot reach the server. Check your internet connection and make sure the backend is running.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}


function getErrorMessage(data: any, fallback: string): string {
  const detail = data?.detail ?? data?.message ?? data?.error;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: any) => item?.msg || item?.message || String(item || ""))
      .filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}

/* ---------------- ROLE HELPER ---------------- */

function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();

  if (normalized === "doctor") {
    return "Doctor";
  }

  if (normalized === "hospital" || normalized === "hospital staff") {
    return "Hospital";
  }

  if (normalized === "superadmin" || normalized === "super admin") {
    return "SuperAdmin";
  }

  return "Patient";
}

/* ---------------- SIGNUP ---------------- */

export async function signup(
  name: string,
  username: string,
  email: string,
  password: string,
  role: string = "Patient",
  firstName: string = "",
  lastName: string = "",
  mobile: string = "",
  gender: string = "",
  dob: string = "",
  age: number | null = null,
  specialization: string = "",
  hospital: string = "",
  pmdcNumber: string = "",
  countryCode: string = ""
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/signup`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        username,
        email,
        password,
        role: normalizeRole(role),

        // Personal information
        first_name: firstName,
        last_name: lastName,
        mobile,
        country_code: countryCode,
        gender,
        dob,
        age,

        // Doctor information
        specialization,
        hospital,
        pmdc_number: pmdcNumber,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Signup failed. Please review your information and try again."));
  }

  return data;
}
/* ---------------- LOGIN ---------------- */

export async function login(
  email: string,
  password: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Login failed. Check your email and password."));
  }

  /*
   * Support different backend response formats:
   *
   * {
   *   access_token: "...",
   *   role: "Patient"
   * }
   *
   * or:
   *
   * {
   *   token: "...",
   *   role: "Doctor"
   * }
   *
   * or:
   *
   * {
   *   accessToken: "...",
   *   user: {
   *     role: "Patient"
   *   }
   * }
   */

  const token =
    data.access_token ||
    data.token ||
    data.accessToken;

  const role =
    data.role ||
    data.user?.role ||
    data.userRole;

  /* Save authentication token locally */
  if (token) {
    await saveToken(token);
  }

  /* Save normalized role locally */
  if (role) {
    await saveUserRole(
      normalizeRole(role)
    );
  }

  // Namespace private offline cache by a one-way local hash of the account identity.
  await setOfflineOwnerIdentity(email);

  return data;
}

/* ---------------- OTP ---------------- */

export async function sendOtp(
  email: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/send-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Could not send the verification code."));
  }

  return data;
}

export async function verifyOtp(
  email: string,
  otp: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/verify-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "OTP verification failed."));
  }

  return data;
}

export async function resendOtpApi(
  email: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/resend-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Could not resend the verification code."));
  }

  return data;
}

/* ---------------- PROFILE ---------------- */

export async function getProfile() {
  const {
    getToken,
  } = await import("./storage");

  const token = await getToken();

  /*
   * New version uses /api/profile.
   * This replaces the old /profile endpoint.
   */
  const response = await fetchWithTimeout(
    `${BASE_URL}/api/profile`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    const error: any = new Error(getErrorMessage(data, "Failed to load profile."));
    error.status = response.status;
    throw error;
  }

  /*
   * Keep locally stored role
   * synchronized with backend.
   */
  if (data.role) {
    await saveUserRole(
      normalizeRole(data.role)
    );
  }

  return data;
}

/* ---------------- UPDATE PROFILE ---------------- */

export async function updateProfile(data: {
  name: string;
  specialization: string;
  hospital: string;
  pmdc_number: string;
}) {
  const {
    getToken,
  } = await import("./storage");

  const token = await getToken();

  const response = await fetchWithTimeout(
    `${BASE_URL}/api/profile`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify(data),
    }
  );

  const text = await response.text();

  const result = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(result, "Failed to update profile."));
  }

  return result;
}

/* ---------------- UPDATE ROLE ---------------- */

export async function updateRole(
  role: string
) {
  const {
    getToken,
  } = await import("./storage");

  const token = await getToken();

  const normalizedRole =
    normalizeRole(role);

  const response = await fetchWithTimeout(
    `${BASE_URL}/api/profile/role`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify({
        role: normalizedRole,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to update role."));
  }

  /*
   * Keep local role synchronized
   * after successfully updating it.
   */
  const updatedRole =
    data.role || normalizedRole;

  await saveUserRole(
    normalizeRole(updatedRole)
  );

  return data;
}

/* ---------------- PASSWORD RESET ---------------- */

/*
 * These functions existed in the old version
 * and are intentionally preserved.
 */

export async function requestPasswordReset(
  email: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/password-reset/request-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to request password reset."));
  }

  return data;
}

export async function verifyPasswordResetOtp(
  email: string,
  otp: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/password-reset/verify-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to verify OTP."));
  }

  return data;
}

export async function resetPassword(
  email: string,
  otp: string,
  new_password: string
) {
  const response = await fetchWithTimeout(
    `${BASE_URL}/password-reset/reset`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
        new_password,
      }),
    }
  );

  const text = await response.text();

  const data = text
    ? JSON.parse(text)
    : {};

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to reset password."));
  }

  return data;
}
