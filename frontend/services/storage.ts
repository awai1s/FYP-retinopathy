import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "token";
const ROLE_KEY = "userRole";

export type UserRole = "Patient" | "Doctor" | "Hospital" | "SuperAdmin";

export const saveToken = async (token: string) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const getToken = async () => AsyncStorage.getItem(TOKEN_KEY);

export const removeToken = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY]);
};

export const saveUserRole = async (role: UserRole) => {
  await AsyncStorage.setItem(ROLE_KEY, role);
};

export const getUserRole = async (): Promise<UserRole | null> => {
  const role = await AsyncStorage.getItem(ROLE_KEY);
  if (role === "Patient" || role === "Doctor" || role === "Hospital" || role === "SuperAdmin") return role;
  return null;
};

export const removeUserRole = async () => {
  await AsyncStorage.removeItem(ROLE_KEY);
};
