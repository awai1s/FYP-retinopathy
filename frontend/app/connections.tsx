import ConnectionScreen from "../components/ConnectionScreen";

import { useThemeRefresh } from "../providers/AppThemeProvider";
export default function PatientConnectionsRoute() {
  useThemeRefresh();
  return <ConnectionScreen role="Patient" />;
}
