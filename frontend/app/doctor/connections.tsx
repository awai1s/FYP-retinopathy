import ConnectionScreen from "../../components/ConnectionScreen";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function DoctorConnectionsRoute() {
  useThemeRefresh();
  return <ConnectionScreen role="Doctor" />;
}
