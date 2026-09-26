import ConnectionScreen from "../../components/ConnectionScreen";
import { useThemeRefresh } from "../../providers/AppThemeProvider";

/**
 * Phase 10D makes patient search a safe care-directory workflow.
 * Clinical charts are opened only from accepted connections inside ConnectionScreen.
 */
export default function DoctorSearchPatientScreen() {
  useThemeRefresh();
  return <ConnectionScreen role="Doctor" />;
}
