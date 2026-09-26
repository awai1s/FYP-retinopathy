import { Stack } from "expo-router";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function AuthLayout() {
  useThemeRefresh();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
    </Stack>
  );
} 
