import { useEffect } from "react";
import { router } from "expo-router";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function Signup() {
  useThemeRefresh();
  useEffect(() => {
    router.replace("/auth/signup/step1" as never);
  }, []);

  return null;
}
