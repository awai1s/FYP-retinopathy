import { router } from "expo-router";
import { getProfile } from "./auth";
import { saveUserRole, UserRole } from "./storage";

export const getRoleHome = (role: UserRole) => {
  switch (role) {
    case "Patient":
      return "/tabs/dashboard";

    case "Doctor":
      return "/doctor/dashboard";

    case "Hospital":
      return "/hospital/dashboard";

    case "SuperAdmin":
      return "/superadmin/dashboard";

    default:
      return "/auth/login";
  }
};

export const routeUserByRole = async () => {
  try {
    const profile = await getProfile();

    const rawRole = String(
      profile?.role || ""
    ).trim();

    let role: UserRole | null = null;

    if (rawRole.toLowerCase() === "patient") {
      role = "Patient";
    } else if (rawRole.toLowerCase() === "doctor") {
      role = "Doctor";
    } else if (
      rawRole.toLowerCase() === "hospital" ||
      rawRole.toLowerCase() === "hospital staff"
    ) {
      role = "Hospital";
    } else if (
      rawRole.toLowerCase() === "superadmin" ||
      rawRole.toLowerCase() === "super admin"
    ) {
      role = "SuperAdmin";
    }

    if (!role) {
      throw new Error("Invalid account role.");
    }

    await saveUserRole(role);

    router.replace(getRoleHome(role) as any);

    return role;
  } catch (error) {
    console.error(
      "ROLE NAVIGATION ERROR:",
      error
    );

    throw error;
  }
};
