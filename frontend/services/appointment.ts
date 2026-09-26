import { getToken } from "./storage";
import BASE_URL from "./api";
import { isLikelyNetworkError, readOfflineCache, writeOfflineCache } from "./offlineCache";

export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "Rejected";

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  date: string;
  time: string;
  reason?: string;
  status: AppointmentStatus;
  createdAt?: string;
  encounterId?: string | null;
  encounterStatus?: "draft" | "in_progress" | "completed" | null;
  encounterStartedAt?: string | null;
  encounterCompletedAt?: string | null;
}

export interface CreateAppointmentPayload {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

const getAuthHeaders = async () => {
  const token = await getToken();

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

const handleResponse = async (
  response: Response,
  defaultMessage: string
) => {
  if (!response.ok) {
    const errorText = await response.text();

    let message = defaultMessage;

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

  return response.json();
};

/**
 * Get appointments for the logged-in patient.
 *
 * BACKEND CONTRACT:
 * GET /api/appointments/patient
 */
export const getPatientAppointments = async (): Promise<
  Appointment[]
> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/appointments/patient`, { method: "GET", headers });
    if (!response.ok) {
      const error: any = new Error("Failed to load appointments.");
      error.status = response.status;
      try {
        const body = await response.json();
        error.message = body.detail || body.message || error.message;
      } catch {}
      throw error;
    }
    const data = await response.json();
    const items = Array.isArray(data) ? data : data.appointments || data.results || [];
    const appointments: Appointment[] = items.map((item: any) => ({
      id: String(item.id || item.appointmentId || ""),
      patientId: String(item.patientId || item.patient_id || ""),
      patientName: item.patientName || item.patient_name || "",
      doctorId: String(item.doctorId || item.doctor_id || ""),
      doctorName: item.doctorName || item.doctor_name || item.doctor?.name || "Doctor",
      date: item.date || item.appointmentDate || item.appointment_date || "",
      time: item.time || item.appointmentTime || item.appointment_time || "",
      reason: item.reason || item.notes || "",
      status: item.status || "Pending",
      createdAt: item.createdAt || item.created_at || "",
      encounterId: item.encounterId || item.encounter_id || null,
      encounterStatus: item.encounterStatus || item.encounter_status || null,
      encounterStartedAt: item.encounterStartedAt || item.encounter_started_at || null,
      encounterCompletedAt: item.encounterCompletedAt || item.encounter_completed_at || null,
    }));

    // Keep only upcoming server-confirmed/requested visits in the private offline cache.
    await writeOfflineCache(
      "patient-appointments",
      appointments.filter((item) => item.status === "Pending" || item.status === "Confirmed")
    );
    return appointments;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<Appointment[]>("patient-appointments")
      : null;
    if (cached) return cached;
    console.error("getPatientAppointments error:", error);
    throw error;
  }
};

/**
 * Get appointments for the logged-in doctor.
 *
 * BACKEND CONTRACT:
 * GET /api/appointments/doctor
 */
export const getDoctorAppointments = async (): Promise<
  Appointment[]
> => {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${BASE_URL}/api/appointments/doctor`,
      {
        method: "GET",
        headers,
      }
    );

    const data = await handleResponse(
      response,
      "Failed to load doctor appointments."
    );

    const appointments = Array.isArray(data)
      ? data
      : data.appointments ||
        data.results ||
        [];

    return appointments.map(
      (item: any): Appointment => ({
        id: String(
          item.id ||
            item.appointmentId ||
            ""
        ),

        patientId: String(
          item.patientId ||
            item.patient_id ||
            ""
        ),

        patientName:
          item.patientName ||
          item.patient_name ||
          item.patient?.name ||
          "Patient",

        doctorId: String(
          item.doctorId ||
            item.doctor_id ||
            ""
        ),

        doctorName:
          item.doctorName ||
          item.doctor_name ||
          "",

        date:
          item.date ||
          item.appointmentDate ||
          item.appointment_date ||
          "",

        time:
          item.time ||
          item.appointmentTime ||
          item.appointment_time ||
          "",

        reason:
          item.reason ||
          item.notes ||
          "",

        status:
          item.status ||
          "Pending",

        createdAt:
          item.createdAt ||
          item.created_at ||
          "",

        encounterId:
          item.encounterId ||
          item.encounter_id ||
          null,

        encounterStatus:
          item.encounterStatus ||
          item.encounter_status ||
          null,

        encounterStartedAt:
          item.encounterStartedAt ||
          item.encounter_started_at ||
          null,

        encounterCompletedAt:
          item.encounterCompletedAt ||
          item.encounter_completed_at ||
          null,
      })
    );
  } catch (error) {
    console.error(
      "getDoctorAppointments error:",
      error
    );

    throw error;
  }
};

/**
 * Create a new appointment.
 *
 * BACKEND CONTRACT:
 * POST /api/appointments
 */
export const createAppointment = async (
  payload: CreateAppointmentPayload
): Promise<Appointment> => {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${BASE_URL}/api/appointments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    return await handleResponse(
      response,
      "Failed to create appointment."
    );
  } catch (error) {
    console.error(
      "createAppointment error:",
      error
    );

    throw error;
  }
};

/**
 * Update appointment status.
 *
 * BACKEND CONTRACT:
 * PATCH /api/appointments/{id}/status
 */
export const updateAppointmentStatus = async (
  appointmentId: string,
  status: AppointmentStatus
): Promise<Appointment> => {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${BASE_URL}/api/appointments/${appointmentId}/status`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status,
        }),
      }
    );

    return await handleResponse(
      response,
      "Failed to update appointment."
    );
  } catch (error) {
    console.error(
      "updateAppointmentStatus error:",
      error
    );

    throw error;
  }
};

/**
 * Cancel an appointment.
 */
export const cancelAppointment = async (
  appointmentId: string
): Promise<Appointment> => {
  return updateAppointmentStatus(
    appointmentId,
    "Cancelled"
  );
};


export const getDoctorAvailability = async (doctorId: string, date: string): Promise<string[]> => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_URL}/api/doctors/${encodeURIComponent(doctorId)}/availability?date=${encodeURIComponent(date)}`, { headers });
  const data = await handleResponse(response, "Failed to load doctor availability.");
  return Array.isArray(data.availableSlots) ? data.availableSlots : [];
};
