import {
  getUserRole,
  UserRole,
} from "./storage";

export const PATIENT_ROLE: UserRole =
  "Patient";

export const DOCTOR_ROLE: UserRole =
  "Doctor";

export const HOSPITAL_ROLE: UserRole =
  "Hospital";

export const SUPERADMIN_ROLE: UserRole =
  "SuperAdmin";

export const getCurrentUserRole =
  async (): Promise<UserRole | null> => {
    return await getUserRole();
  };

export const isPatient = (
  role: UserRole | null
) => role === "Patient";

export const isDoctor = (
  role: UserRole | null
) => role === "Doctor";

export const isHospital = (
  role: UserRole | null
) => role === "Hospital";

export const isSuperAdmin = (
  role: UserRole | null
) => role === "SuperAdmin";
