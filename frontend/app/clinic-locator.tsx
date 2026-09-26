import { Alert } from "../services/alert";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import Button from "../design/components/Button";
import IconContainer from "../design/components/IconContainer";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";
import shadows from "../design/tokens/shadows";
import {
  buildCityEyeCareMapsUrl,
  buildGoogleMapsClinicLocationUrl,
  buildGoogleMapsDirectionsUrl,
  buildNearbyEyeCareMapsUrl,
  ClinicCoordinates,
  ClinicPlace,
  ClinicSearchMode,
  getNearbyClinics,
  searchClinicsByCity,
} from "../services/clinic";
import { recordCareNavigation } from "../services/patient";

import { useThemeRefresh } from "../providers/AppThemeProvider";
const formatDistance = (distanceKm?: number | null): string | null => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.max(50, Math.round(distanceKm * 1000))} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

const clinicDistanceLabel = (clinic: ClinicPlace, mode: ClinicSearchMode): string => {
  const formatted = formatDistance(clinic.distanceKm);
  if (formatted) {
    return mode === "city"
      ? `≈ ${formatted} from city centre`
      : `${formatted} away`;
  }
  return clinic.areaLabel ? `${clinic.areaLabel} area` : "Local eye-care provider";
};

export default function ClinicLocatorScreen() {
  useThemeRefresh();
  const [coordinates, setCoordinates] = useState<ClinicCoordinates | null>(null);
  const [clinics, setClinics] = useState<ClinicPlace[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState("");
  const [attribution, setAttribution] = useState(
    "Clinic data from OpenStreetMap and public local clinic records"
  );
  const [fallbackUrl, setFallbackUrl] = useState(buildNearbyEyeCareMapsUrl(null));
  const [searchMode, setSearchMode] = useState<ClinicSearchMode>("nearby");
  const [searchLabel, setSearchLabel] = useState("Near you");
  const [cityQuery, setCityQuery] = useState("");
  const [activeCity, setActiveCity] = useState("");

  const locationLabel = useMemo(() => {
    if (loadingLocation) return "Detecting your location";
    if (!coordinates) return "Location unavailable — you can still search by city";
    return `Location detected • ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
  }, [coordinates, loadingLocation]);

  const sectionTitle =
    searchMode === "city" ? `Eye clinics in ${searchLabel}` : "Nearby clinics";

  const haptic = () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  };

  const openUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("This map link is not supported on your device.");
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert(
        "Unable to open Google Maps",
        err?.message || "Please check your connection and try again."
      );
    }
  }, []);

  const applyClinicResponse = useCallback((response: any) => {
    setClinics(response.clinics || []);
    setAttribution(
      response.attribution || "Clinic data from OpenStreetMap and public local clinic records"
    );
    setFallbackUrl(response.googleMapsFallbackUrl || buildNearbyEyeCareMapsUrl(null));
    setSearchMode(response.searchMode === "city" ? "city" : "nearby");
    setSearchLabel(response.searchLabel || (response.searchMode === "city" ? "Selected city" : "Near you"));
  }, []);

  const fetchNearby = useCallback(
    async (nextCoordinates: ClinicCoordinates) => {
      setLoadingClinics(true);
      setError("");
      try {
        const response = await getNearbyClinics({
          latitude: nextCoordinates.latitude,
          longitude: nextCoordinates.longitude,
          limit: 18,
        });
        applyClinicResponse(response);
        setActiveCity("");
      } catch (err: any) {
        setClinics([]);
        setSearchMode("nearby");
        setSearchLabel("Near you");
        setFallbackUrl(buildNearbyEyeCareMapsUrl(nextCoordinates));
        setError(err?.message || "We couldn't load nearby clinics. Please try again.");
      } finally {
        setLoadingClinics(false);
      }
    },
    [applyClinicResponse]
  );

  const requestLocationAndLoad = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoadingLocation(true);
      setPermissionDenied(false);
      setError("");

      try {
        if (Platform.OS !== "web") {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            throw new Error("Location services are turned off. Please enable them and try again.");
          }
        }

        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionDenied(true);
          setCoordinates(null);
          setError("");
          return;
        }

        let position = await Location.getLastKnownPositionAsync({
          maxAge: 90_000,
          requiredAccuracy: 1200,
        });

        if (!position || isRefresh) {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }

        const nextCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(nextCoordinates);
        setFallbackUrl(buildNearbyEyeCareMapsUrl(nextCoordinates));
        haptic();
        await fetchNearby(nextCoordinates);
      } catch (err: any) {
        setError(err?.message || "We couldn't read your location. Please try again.");
      } finally {
        setLoadingLocation(false);
        setRefreshing(false);
      }
    },
    [fetchNearby]
  );

  const searchCity = useCallback(
    async (overrideCity?: string) => {
      const city = (overrideCity ?? cityQuery).trim();
      if (city.length < 2) {
        setError("Enter a city name, for example Islamabad, Lahore or Attock.");
        return;
      }

      setLoadingClinics(true);
      setError("");
      haptic();
      try {
        const response = await searchClinicsByCity(city, 24);
        applyClinicResponse(response);
        const label = response.searchLabel || city;
        setActiveCity(label);
        setCityQuery(label);
        setFallbackUrl(response.googleMapsFallbackUrl || buildCityEyeCareMapsUrl(label));
      } catch (err: any) {
        setClinics([]);
        setSearchMode("city");
        setSearchLabel(city);
        setActiveCity(city);
        setFallbackUrl(buildCityEyeCareMapsUrl(city));
        setError(err?.message || "We couldn't search that city. Please try again.");
      } finally {
        setLoadingClinics(false);
      }
    },
    [applyClinicResponse, cityQuery]
  );

  const returnToNearMe = useCallback(async () => {
    setCityQuery("");
    setActiveCity("");
    setError("");
    if (coordinates) {
      await fetchNearby(coordinates);
      return;
    }
    await requestLocationAndLoad(false);
  }, [coordinates, fetchNearby, requestLocationAndLoad]);

  const refreshCurrentSearch = useCallback(async () => {
    setRefreshing(true);
    try {
      if (searchMode === "city" && activeCity) {
        await searchCity(activeCity);
      } else {
        await requestLocationAndLoad(true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeCity, requestLocationAndLoad, searchCity, searchMode]);

  useEffect(() => {
    void requestLocationAndLoad(false);
  }, [requestLocationAndLoad]);

  const openClinic = async (clinic: ClinicPlace) => {
    haptic();
    await openUrl(buildGoogleMapsClinicLocationUrl(clinic));
  };

  const openDirections = async (clinic: ClinicPlace) => {
    haptic();

    // Phase 8 integration: record the explicit care-navigation step without
    // blocking Google Maps if history logging is temporarily unavailable.
    void recordCareNavigation({
      clinicId: clinic.id,
      clinicName: clinic.name,
      address: clinic.address,
      action: "Directions",
      searchMode,
      city: searchMode === "city" ? activeCity || searchLabel : undefined,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    }).catch((historyError) => {
      console.warn("Care-navigation history could not be recorded:", historyError);
    });

    await openUrl(buildGoogleMapsDirectionsUrl(clinic));
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert(
          "Allow location",
          "Enable location permission for this site in your browser settings, then press Try again."
        );
      } else {
        await Linking.openSettings();
      }
    } catch {
      Alert.alert("Settings unavailable", "Please open your device settings manually.");
    }
  };

  const initialLoading = loadingLocation && clinics.length === 0 && !activeCity;

  return (
    <AppShell
      role="Patient"
      title="Clinic Locator"
      subtitle="Find eye clinics, specialists and hospitals"
      showBack
      onBackPress={() => router.back()}
      scrollable={false}
      showAssistant={false}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshCurrentSearch()}
            tintColor={colors.teal700}
          />
        }
      >
        <LinearGradient
          colors={[colors.navyInk, "#07343C", colors.teal800]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons name="location-outline" size={27} color={colors.neonAqua} />
          </View>
          <Text style={styles.heroEyebrow}>EYE CARE LOCATOR</Text>
          <Text style={styles.heroTitle}>Find the right eye care</Text>
          <Text style={styles.heroSubtitle}>
            See nearby eye clinics automatically, or search another city to find smaller clinics, specialists and eye hospitals there.
          </Text>

          <View style={styles.locationPill}>
            {loadingLocation ? (
              <ActivityIndicator size="small" color={colors.neonAqua} />
            ) : (
              <Ionicons
                name={coordinates ? "checkmark-circle" : "location-outline"}
                size={17}
                color={coordinates ? colors.neonAqua : colors.textLight}
              />
            )}
            <Text style={styles.locationPillText}>{locationLabel}</Text>
          </View>
        </LinearGradient>

        <Card variant="elevated" style={styles.citySearchCard}>
          <View style={styles.citySearchHeader}>
            <IconContainer
              name="business-outline"
              size={21}
              color={colors.teal800}
              backgroundColor={colors.teal50}
            />
            <View style={styles.citySearchHeaderText}>
              <Text style={styles.citySearchTitle}>Search by city</Text>
              <Text style={styles.citySearchSubtitle}>
                Enter a city to see eye clinics and hospitals available there.
              </Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={19} color={colors.textMuted} />
              <TextInput
                value={cityQuery}
                onChangeText={setCityQuery}
                onSubmitEditing={() => void searchCity()}
                placeholder="e.g. Islamabad, Lahore, Attock"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
                accessibilityLabel="Search eye clinics by city"
              />
              {cityQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setCityQuery("")}
                  style={styles.clearButton}
                  accessibilityLabel="Clear city search"
                >
                  <Ionicons name="close-circle" size={19} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              activeOpacity={0.84}
              style={styles.searchButton}
              onPress={() => void searchCity()}
              disabled={loadingClinics}
            >
              {loadingClinics && searchMode === "city" ? (
                <ActivityIndicator size="small" color={colors.navyInk} />
              ) : (
                <Ionicons name="search" size={18} color={colors.navyInk} />
              )}
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {permissionDenied ? (
          <Card variant="bordered" style={styles.permissionCard}>
            <View style={styles.noticeRow}>
              <IconContainer
                name="location-outline"
                size={22}
                color={colors.warning}
                backgroundColor={colors.warningBg}
              />
              <View style={styles.noticeMain}>
                <Text style={styles.noticeTitle}>Location permission needed for “Near me”</Text>
                <Text style={styles.noticeText}>
                  You can still search by city above, or allow location access to see clinics closest to you.
                </Text>
              </View>
            </View>
            <View style={styles.noticeActions}>
              <Button
                title="Try location again"
                icon="refresh-outline"
                size="sm"
                onPress={() => void requestLocationAndLoad(false)}
              />
              <Button
                title="Settings"
                icon="settings-outline"
                variant="outline"
                size="sm"
                onPress={openSettings}
              />
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card variant="bordered" style={styles.errorCard}>
            <View style={styles.noticeRow}>
              <IconContainer
                name="alert-circle-outline"
                size={22}
                color={colors.error}
                backgroundColor={colors.errorBg}
              />
              <View style={styles.noticeMain}>
                <Text style={styles.noticeTitle}>Couldn't load clinic results</Text>
                <Text style={styles.noticeText}>{error}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionEyebrow}>
              {searchMode === "city" ? "CITY SEARCH" : "EYE CARE AROUND YOU"}
            </Text>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>
              {searchMode === "city"
                ? "Includes small eye clinics and specialist practices, not only major hospitals."
                : "Nearby results prioritize eye clinics and specialists, with hospitals included when useful."}
            </Text>
          </View>

          {searchMode === "city" ? (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => void returnToNearMe()}
              activeOpacity={0.82}
            >
              <Ionicons name="locate-outline" size={18} color={colors.teal800} />
              <Text style={styles.refreshText}>Near me</Text>
            </TouchableOpacity>
          ) : coordinates && !initialLoading ? (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => void requestLocationAndLoad(true)}
              activeOpacity={0.82}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.teal800} />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {initialLoading || loadingClinics ? (
          <Card variant="elevated" style={styles.loadingCard}>
            <View style={styles.loadingIconWrap}>
              <ActivityIndicator size="large" color={colors.teal600} />
            </View>
            <Text style={styles.loadingTitle}>
              {searchMode === "city" && activeCity
                ? `Finding eye clinics in ${activeCity}`
                : "Finding eye clinics near you"}
            </Text>
            <Text style={styles.loadingText}>
              Looking for clinics, ophthalmologists, optometrists and eye hospitals.
            </Text>
          </Card>
        ) : null}

        {!loadingClinics && clinics.length > 0 ? (
          <View style={styles.listGap}>
            {clinics.map((clinic, index) => (
              <Card
                key={clinic.id}
                variant="elevated"
                style={styles.clinicCard}
                onPress={() => void openClinic(clinic)}
                accessibilityLabel={`Open ${clinic.name} in Google Maps`}
              >
                <View style={styles.clinicTopRow}>
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.clinicMain}>
                    <Text style={styles.clinicName}>{clinic.name}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.categoryChip}>
                        <Ionicons name="eye-outline" size={13} color={colors.teal800} />
                        <Text style={styles.categoryText}>{clinic.category || "Eye Clinic"}</Text>
                      </View>
                      <Text style={styles.distanceText}>
                        {clinicDistanceLabel(clinic, searchMode)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapArrow}>
                    <Ionicons name="chevron-forward" size={20} color={colors.teal800} />
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {clinic.address}
                  </Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.mapButton}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      void openClinic(clinic);
                    }}
                  >
                    <Ionicons name="map-outline" size={17} color={colors.navyInk} />
                    <Text style={styles.mapButtonText}>View on Google Maps</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.directionsButton}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      void openDirections(clinic);
                    }}
                  >
                    <Ionicons name="navigate-outline" size={17} color={colors.teal800} />
                    <Text style={styles.directionsText}>Directions</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {!loadingClinics && clinics.length === 0 && !initialLoading ? (
          <Card variant="accent" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medkit-outline" size={26} color={colors.teal700} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchMode === "city"
                ? `No eye clinics found for ${searchLabel}`
                : "No nearby clinics found yet"}
            </Text>
            <Text style={styles.emptyText}>
              {searchMode === "city"
                ? "Try another spelling or open the broader Google Maps search for this city."
                : "Refresh your location, or search a city above to explore more eye-care options."}
            </Text>
            <Button
              title={searchMode === "city" ? "Search this city in Google Maps" : "Search in Google Maps"}
              icon="map-outline"
              onPress={() => void openUrl(fallbackUrl)}
              style={styles.emptyButton}
            />
          </Card>
        ) : null}

        {clinics.length > 0 ? (
          <View style={styles.footerRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.footerText}>
              {attribution}. Tap any clinic to open it in Google Maps.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.huge,
  },
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.elevated3D,
  },
  heroGlow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 120,
    right: -70,
    top: -105,
    backgroundColor: "rgba(39,229,198,0.10)",
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(39,229,198,0.12)",
    borderWidth: 1,
    borderColor: "rgba(39,229,198,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  heroEyebrow: {
    color: colors.neonAqua,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.35,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.extraBold,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: colors.textLight,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 760,
  },
  locationPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xl,
  },
  locationPillText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  citySearchCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  citySearchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  citySearchHeaderText: {
    flex: 1,
  },
  citySearchTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.extraBold,
  },
  citySearchSubtitle: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: 19,
    marginTop: 3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.teal200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    paddingVertical: Platform.OS === "web" ? 13 : 10,
    outlineStyle: "none" as any,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neonAqua,
    borderWidth: 1,
    borderColor: colors.teal300,
    ...shadows.sm,
  },
  searchButtonText: {
    color: colors.navyInk,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.extraBold,
  },
  permissionCard: {
    marginBottom: spacing.lg,
    borderColor: colors.warningBorder,
  },
  errorCard: {
    marginBottom: spacing.lg,
    borderColor: colors.errorBorder,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  noticeMain: {
    flex: 1,
  },
  noticeTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
  },
  noticeText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: 20,
    marginTop: 4,
  },
  noticeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionEyebrow: {
    color: colors.teal700,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.extraBold,
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.extraBold,
    marginTop: 3,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 680,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal200,
  },
  refreshText: {
    color: colors.teal800,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  loadingIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
    marginBottom: spacing.md,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    textAlign: "center",
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    marginTop: 5,
    textAlign: "center",
  },
  listGap: {
    gap: spacing.md,
  },
  clinicCard: {
    padding: spacing.lg,
  },
  clinicTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  numberBadge: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.teal100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.teal200,
  },
  numberText: {
    color: colors.teal900,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.extraBold,
  },
  clinicMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  clinicName: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.extraBold,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal100,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryText: {
    color: colors.teal800,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  distanceText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  mapArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: spacing.md,
    paddingLeft: 55,
  },
  addressText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: 19,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mapButton: {
    flex: 1,
    minWidth: 190,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neonAqua,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  mapButtonText: {
    color: colors.navyInk,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.extraBold,
  },
  directionsButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.teal200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: spacing.lg,
  },
  directionsText: {
    color: colors.teal800,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal50,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.extraBold,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 520,
    marginTop: spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: spacing.lg,
    paddingHorizontal: 4,
  },
  footerText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.tiny,
    lineHeight: 17,
  },
});
