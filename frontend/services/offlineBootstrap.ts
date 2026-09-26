import { getUserRole } from "./storage";
import { getPatientDashboard } from "./patient";
import { getPatientAppointments } from "./appointment";
import { getMedicationAdherence, getPatientPrescriptions } from "./prescriptions";
import { getHealthCard } from "./privacy";
import { getEducationAssignments } from "./education";

/**
 * Refresh only the deliberately approved Phase 10L offline dataset.
 * This does NOT fetch/store retinal images, medical PDFs, full patient history,
 * clinical notes, report bodies, or provider records.
 */
export async function refreshEssentialPatientOfflineCache(): Promise<boolean> {
  const role = await getUserRole();
  if (role !== "Patient") return false;

  await Promise.allSettled([
    getPatientDashboard(),
    getPatientAppointments(),
    getPatientPrescriptions(),
    getMedicationAdherence(7),
    getMedicationAdherence(30),
    getHealthCard(),
    getEducationAssignments(),
  ]);
  return true;
}
