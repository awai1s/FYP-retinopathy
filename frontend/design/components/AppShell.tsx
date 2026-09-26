/**
 * Role-Based App Shell Component
 * Unified layout shell providing Header, Mobile Drawer Sidebar, and Container
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import colors from "../tokens/colors";
import { useAppTheme } from "../../providers/AppThemeProvider";
import TopHeader from "./TopHeader";
import MobileSidebar, { UserRoleType } from "./MobileSidebar";
import PageContainer from "./PageContainer";
import { NavItemConfig } from "./SidebarNavItem";
import AIAssistantWidget from "../../components/AIAssistantWidget";
import { getProfile } from "../../services/auth";
import OfflineStatusBanner from "../../components/offline/OfflineStatusBanner";
import { useNetwork } from "../../providers/NetworkProvider";
import { setSidebarVisible } from "../../services/sidebarVisibility";

export interface AppShellProps {
  children: React.ReactNode;
  role: UserRoleType;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  scrollable?: boolean;
  userName?: string;
  customNavItems?: NavItemConfig[];
  showAssistant?: boolean;
}

export const getRoleNavItems = (role: UserRoleType): NavItemConfig[] => {
  switch (role) {
    case "Patient":
      return [
        { label: "Dashboard", route: "/tabs/dashboard", icon: "grid-outline" },
        { label: "Upload Screening", route: "/upload", icon: "cloud-upload-outline" },
        { label: "Vision Tests", route: "/vision-tests", icon: "eye-outline" },
        { label: "Vision Simulator", route: "/vision-simulator", icon: "git-compare-outline" },
        { label: "Vision & Lens Vault", route: "/vision-vault", icon: "glasses-outline" },
        { label: "Learn & Eye Health", route: "/education", icon: "library-outline" },
        { label: "Appointments", route: "/appointments", icon: "calendar-outline" },
        { label: "My Care Team", route: "/connections", icon: "people-outline" },
        { label: "Clinic Locator", route: "/clinic-locator", icon: "location-outline" },
        { label: "My Analytics", route: "/analytics", icon: "stats-chart-outline" },
        { label: "Prescriptions", route: "/prescriptions", icon: "medkit-outline" },
        { label: "Health History", route: "/tabs/history", icon: "time-outline" },
        { label: "My Profile", route: "/tabs/profile", icon: "person-outline" },
        { label: "Privacy & Access", route: "/privacy", icon: "shield-checkmark-outline" },
        { label: "Appearance", route: "/settings", icon: "contrast-outline" },
      ];

    case "Doctor":
      return [
        { label: "Dashboard", route: "/doctor/dashboard", icon: "grid-outline" },
        { label: "Find Patients", route: "/doctor/search-patient", icon: "search-outline" },
        { label: "AI Screening Reports", route: "/doctor-summary", icon: "document-text-outline" },
        { label: "Clinical Tools", route: "/doctor/tools", icon: "medical-outline" },
        { label: "My Patients", route: "/doctor/connections", icon: "people-outline" },
        { label: "Watchlist", route: "/doctor/watchlist", icon: "bookmark-outline" },
        { label: "Appointments", route: "/doctor/appointments", icon: "calendar-outline" },
        { label: "Consultations", route: "/doctor/consultations", icon: "clipboard-outline" },
        { label: "Hospital Privileges", route: "/doctor/privileges", icon: "key-outline" },
        { label: "Notifications", route: "/notifications", icon: "notifications-outline" },
        { label: "Appearance", route: "/settings", icon: "contrast-outline" },
      ];

    case "Hospital":
      return [
        { label: "Dashboard", route: "/hospital/dashboard", icon: "grid-outline" },
        { label: "Patient Directory", route: "/hospital/search-patient", icon: "search-outline" },
        { label: "Upload Clinical Report", route: "/hospital/upload-report", icon: "cloud-upload-outline" },
        { label: "Screening Reports", route: "/hospital/reports", icon: "document-text-outline" },
        { label: "Hospital Analytics", route: "/hospital/overview", icon: "stats-chart-outline" },
        { label: "Equipment", route: "/hospital/equipment", icon: "hardware-chip-outline" },
        { label: "Doctors & Privileges", route: "/hospital/doctors", icon: "people-circle-outline" },
        { label: "Audit Logs", route: "/hospital/audit-logs", icon: "shield-checkmark-outline" },
        { label: "Notifications", route: "/notifications", icon: "notifications-outline" },
        { label: "Appearance", route: "/settings", icon: "contrast-outline" },
      ];

    case "SuperAdmin":
      return [
        { label: "Dashboard", route: "/superadmin/dashboard", icon: "grid-outline" },
        { label: "Verification Queue", route: "/superadmin/verifications", icon: "shield-checkmark-outline" },
        { label: "Audit History", route: "/superadmin/audit", icon: "time-outline" },
        { label: "Notifications", route: "/notifications", icon: "notifications-outline" },
        { label: "Appearance", route: "/settings", icon: "contrast-outline" },
      ];

    default:
      return [];
  }
};

const getLimitedProviderNavItems = (role: UserRoleType): NavItemConfig[] => {
  if (role === "Doctor") {
    return [
      { label: "Dashboard", route: "/doctor/dashboard", icon: "grid-outline" },
      { label: "Profile", route: "/doctor/profile", icon: "person-outline" },
      { label: "Provider Verification", route: "/provider-verification", icon: "shield-checkmark-outline" },
      { label: "Notifications", route: "/notifications", icon: "notifications-outline" },
      { label: "Appearance", route: "/settings", icon: "contrast-outline" },
    ];
  }
  if (role === "Hospital") {
    return [
      { label: "Dashboard", route: "/hospital/dashboard", icon: "grid-outline" },
      { label: "Profile", route: "/hospital/profile", icon: "business-outline" },
      { label: "Provider Verification", route: "/provider-verification", icon: "shield-checkmark-outline" },
      { label: "Notifications", route: "/notifications", icon: "notifications-outline" },
      { label: "Appearance", route: "/settings", icon: "contrast-outline" },
    ];
  }
  return getRoleNavItems(role);
};

export const AppShell: React.FC<AppShellProps> = ({
  children,
  role,
  title,
  subtitle,
  showBack = false,
  onBackPress,
  scrollable = true,
  userName = "User",
  customNavItems,
  showAssistant = true,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarId] = useState(() => Symbol("AppShell sidebar"));
  useEffect(() => {
    setSidebarVisible(sidebarId, drawerOpen);
    return () => setSidebarVisible(sidebarId, false);
  }, [drawerOpen, sidebarId]);
  const [providerState, setProviderState] = useState<{ verificationStatus: string; accountStatus: string } | null>(null);
  const { colors: semanticColors } = useAppTheme();
  const { isOnline } = useNetwork();
  const isProvider = role === "Doctor" || role === "Hospital";

  useEffect(() => {
    let mounted = true;
    if (!isProvider) {
      setProviderState(null);
      return () => { mounted = false; };
    }
    void getProfile()
      .then((profile) => {
        if (!mounted) return;
        setProviderState({
          verificationStatus: String(profile?.verificationStatus || "pending").toLowerCase(),
          accountStatus: String(profile?.accountStatus || "active").toLowerCase(),
        });
      })
      .catch(() => {
        if (mounted) setProviderState({ verificationStatus: "pending", accountStatus: "active" });
      });
    return () => { mounted = false; };
  }, [isProvider, role]);

  const providerRestricted = isProvider && (
    !providerState ||
    providerState.verificationStatus !== "verified" ||
    providerState.accountStatus !== "active"
  );
  const navItems = customNavItems || (providerRestricted ? getLimitedProviderNavItems(role) : getRoleNavItems(role));
  const assistantAllowed = showAssistant && role !== "SuperAdmin" && !providerRestricted;

  return (
    <View style={[styles.shellContainer, { backgroundColor: semanticColors.background }]}>
      <TopHeader
        title={title}
        subtitle={subtitle}
        onOpenDrawer={() => setDrawerOpen(true)}
        showBack={showBack}
        onBackPress={onBackPress}
      />

      {role === "Patient" ? <OfflineStatusBanner /> : null}

      <PageContainer scrollable={scrollable}>
        {children}
      </PageContainer>

      {assistantAllowed && isOnline ? <AIAssistantWidget role={role} /> : null}

      <MobileSidebar
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={role}
        navItems={navItems}
        userName={userName}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
    backgroundColor: colors.pageBackground,
    overflow: "hidden",
  },
});

export default AppShell;
