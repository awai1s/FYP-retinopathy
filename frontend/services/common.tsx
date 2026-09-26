import { getToken } from "./storage";
const API_URL = "https://pleasing-perfection-production.up.railway.app";

export interface PatientProfile {
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  email: string;
  dob: string;
  gender: string;
}

export interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  email: string;
  dob: string;
  gender: string;
}


/**
 * Get logged-in patient's profile
 */
export const getMyProfile = async () => {
  const token = await getToken();

  const response = await fetch(`${API_URL}/api/patient/profile`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.detail ||
        data.message ||
        "Failed to load profile."
    );
  }

  return data;
};

/**
 * Update logged-in patient's profile
 */
export const updateMyProfile = async (profile: {
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  email: string;
  dob: string;
  gender: string;
  age: string;
  bloodGroup: string;
  address: string;
}) => {
  const token = await getToken();

  const response = await fetch(`${API_URL}/api/patient/profile`, {
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
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
      mobile: profile.mobile,
      email: profile.email,
      dob: profile.dob,
      gender: profile.gender,
      age: profile.age,
      bloodGroup: profile.bloodGroup,
      address: profile.address,
    }),
  });

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.detail ||
        data.message ||
        "Failed to update profile."
    );
  }

  return data;
};
/**
 * Get a patient's complete profile
 */
export const getPatientProfileInfo = async (
  patientId: string
): Promise<PatientProfile> => {
  try {
    const token = await getToken();

    const response = await fetch(
      `${API_URL}/patients/${patientId}`,
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

    if (!response.ok) {
      const errorText = await response.text();

      let message = "Failed to fetch patient profile.";

      try {
        const errorData = JSON.parse(errorText);

        message =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          message;
      } catch {
        if (errorText) {
          message = errorText;
        }
      }

      throw new Error(message);
    }

    const data = await response.json();

    return {
      firstName: data.firstName || data.first_name || "",
      lastName: data.lastName || data.last_name || "",
      username: data.username || "",
      mobile: data.mobile || data.phone || "",
      email: data.email || "",
      dob: data.dob || data.date_of_birth || "",
      gender: data.gender || "",
    };
  } catch (error) {
    console.error(
      "getPatientProfileInfo error:",
      error
    );

    throw error;
  }
};

/**
 * Search patients
 */
export const searchPatients = async (
  query: string
): Promise<PatientSearchResult[]> => {
  try {
    const token = await getToken();

    const response = await fetch(
      `${API_URL}/patients/search?query=${encodeURIComponent(query)}`,
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

    if (!response.ok) {
      const errorText = await response.text();

      let message = "Failed to search patients.";

      try {
        const errorData = JSON.parse(errorText);

        message =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          message;
      } catch {
        if (errorText) {
          message = errorText;
        }
      }

      throw new Error(message);
    }

    const data = await response.json();

    // Handle APIs that return:
    // { patients: [...] }
    // or directly [...]
    const patients = Array.isArray(data)
      ? data
      : data.patients || data.results || [];

    return patients.map((patient: any) => ({
      id: String(
        patient.id ||
        patient.patientId ||
        patient.patient_id ||
        ""
      ),

      firstName:
        patient.firstName ||
        patient.first_name ||
        "",

      lastName:
        patient.lastName ||
        patient.last_name ||
        "",

      username:
        patient.username ||
        "",

      mobile:
        patient.mobile ||
        patient.phone ||
        "",

      email:
        patient.email ||
        "",

      dob:
        patient.dob ||
        patient.date_of_birth ||
        "",

      gender:
        patient.gender ||
        "",
    }));
  } catch (error) {
    console.error(
      "searchPatients error:",
      error
    );

    throw error;
  }
};