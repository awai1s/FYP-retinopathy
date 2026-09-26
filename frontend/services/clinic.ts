import BASE_URL from "./api";
import { getToken } from "./storage";

export interface ClinicCoordinates {
  latitude: number;
  longitude: number;
}

export type ClinicOwnership = "Public" | "Private" | "Unknown";
export type ClinicSearchMode = "nearby" | "city";

export interface ClinicPlace {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  areaLabel?: string | null;
  locationPrecision?: "coordinate" | "address";
  category?: string;
  specialty?: string;
  source?: string;
  googleMapsUrl?: string;
  googleSearchUrl?: string;
  directionsUrl?: string;

  // Compatibility fields kept for the older, currently unused ClinicMap files.
  osmType?: string;
  osmId?: string;
  estimatedDriveMinutes?: number;
  travelTimeIsEstimate?: boolean;
  openNow?: boolean | null;
  openingHours?: string | null;
  ownership?: ClinicOwnership;
  ownershipSource?: string;
  phone?: string | null;
  websiteUri?: string | null;
  osmUrl?: string | null;
  operator?: string | null;
  types?: string[];
}

export interface ClinicsResponse {
  clinics: ClinicPlace[];
  count: number;
  searchCenter: ClinicCoordinates;
  searchMode: ClinicSearchMode;
  searchLabel: string;
  city?: string;
  source: string;
  cached?: boolean;
  partial?: boolean;
  message?: string;
  googleMapsFallbackUrl?: string;
  attribution?: string;
}

export interface NearbyClinicSearchParams {
  latitude: number;
  longitude: number;
  limit?: number;
}

const formatCoordinate = (value: number) => value.toFixed(7);

export const buildGoogleMapsClinicLocationUrl = (clinic: ClinicPlace): string => {
  if (clinic.googleMapsUrl) return clinic.googleMapsUrl;

  const hasCoordinates =
    Number.isFinite(clinic.latitude) && Number.isFinite(clinic.longitude);

  const query = hasCoordinates
    ? `${formatCoordinate(clinic.latitude as number)},${formatCoordinate(clinic.longitude as number)}`
    : `${clinic.name} ${clinic.address}`.trim();

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const buildGoogleMapsDirectionsUrl = (clinic: ClinicPlace): string => {
  if (clinic.directionsUrl) return clinic.directionsUrl;

  const hasCoordinates =
    Number.isFinite(clinic.latitude) && Number.isFinite(clinic.longitude);

  const destination = hasCoordinates
    ? `${formatCoordinate(clinic.latitude as number)},${formatCoordinate(clinic.longitude as number)}`
    : `${clinic.name} ${clinic.address}`.trim();

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
};

export const buildNearbyEyeCareMapsUrl = (
  coordinates?: ClinicCoordinates | null
): string => {
  const query = coordinates
    ? `eye clinic ophthalmologist near ${formatCoordinate(coordinates.latitude)},${formatCoordinate(coordinates.longitude)}`
    : "eye clinic ophthalmologist near me";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const buildCityEyeCareMapsUrl = (city: string): string => {
  const query = `eye clinic ophthalmologist in ${city}, Pakistan`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const normalizeResponse = (
  payload: any,
  fallbackCenter: ClinicCoordinates,
  fallbackMode: ClinicSearchMode,
  fallbackLabel: string,
  fallbackUrl: string
): ClinicsResponse => {
  const clinics = Array.isArray(payload?.clinics) ? payload.clinics : [];

  return {
    clinics: clinics.map((item: any, index: number): ClinicPlace => ({
      id: String(item?.id || `${item?.latitude}-${item?.longitude}-${index}`),
      name: String(item?.name || "Eye clinic"),
      address: String(item?.address || "Address not available"),
      latitude:
        item?.latitude === null || item?.latitude === undefined
          ? null
          : Number(item.latitude),
      longitude:
        item?.longitude === null || item?.longitude === undefined
          ? null
          : Number(item.longitude),
      distanceKm:
        item?.distanceKm === null || item?.distanceKm === undefined
          ? null
          : Number(item.distanceKm),
      areaLabel: item?.areaLabel ? String(item.areaLabel) : null,
      locationPrecision:
        item?.locationPrecision === "address" ? "address" : "coordinate",
      category: item?.category || "Eye Clinic",
      specialty: item?.specialty || "Ophthalmology / Eye Care",
      source: item?.source,
      googleMapsUrl: item?.googleMapsUrl,
      googleSearchUrl: item?.googleSearchUrl,
      directionsUrl: item?.directionsUrl,
      estimatedDriveMinutes: item?.estimatedDriveMinutes,
      travelTimeIsEstimate: item?.travelTimeIsEstimate,
      openNow: item?.openNow ?? null,
      openingHours: item?.openingHours ?? null,
      ownership: item?.ownership || "Unknown",
      ownershipSource: item?.ownershipSource,
      phone: item?.phone ?? null,
      websiteUri: item?.websiteUri ?? null,
      operator: item?.operator ?? null,
      types: Array.isArray(item?.types) ? item.types : [],
    })),
    count: Number(payload?.count ?? clinics.length),
    searchCenter: payload?.searchCenter || fallbackCenter,
    searchMode: payload?.searchMode === "city" ? "city" : fallbackMode,
    searchLabel: String(payload?.searchLabel || fallbackLabel),
    city: payload?.city ? String(payload.city) : undefined,
    source: String(payload?.source || "OpenStreetMap"),
    cached: Boolean(payload?.cached),
    partial: Boolean(payload?.partial),
    message: payload?.message,
    googleMapsFallbackUrl: payload?.googleMapsFallbackUrl || fallbackUrl,
    attribution: payload?.attribution || "Clinic search data © OpenStreetMap contributors",
  };
};

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const throwClinicError = (response: Response, payload: any, fallback: string): never => {
  const detail = payload?.detail || payload?.message;
  throw new Error(
    typeof detail === "string" && detail.trim()
      ? detail
      : response.status === 404
        ? "No matching city or clinic data was found."
        : fallback
  );
};

export const getNearbyClinics = async ({
  latitude,
  longitude,
  limit = 18,
}: NearbyClinicSearchParams): Promise<ClinicsResponse> => {
  const token = await getToken();
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    limit: String(Math.max(1, Math.min(30, Math.trunc(limit)))),
  });

  const response = await fetch(`${BASE_URL}/api/clinics/nearby?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throwClinicError(response, payload, "Unable to load nearby clinics. Please try again.");
  }

  return normalizeResponse(
    payload,
    { latitude, longitude },
    "nearby",
    "Near you",
    buildNearbyEyeCareMapsUrl({ latitude, longitude })
  );
};

export const searchClinicsByCity = async (
  city: string,
  limit = 24
): Promise<ClinicsResponse> => {
  const trimmedCity = city.trim();
  if (trimmedCity.length < 2) {
    throw new Error("Enter a city name first.");
  }

  const token = await getToken();
  const params = new URLSearchParams({
    city: trimmedCity,
    limit: String(Math.max(1, Math.min(30, Math.trunc(limit)))),
  });

  const response = await fetch(`${BASE_URL}/api/clinics/search?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throwClinicError(response, payload, "Unable to search clinics in that city. Please try again.");
  }

  const center = payload?.searchCenter || { latitude: 0, longitude: 0 };
  const label = String(payload?.searchLabel || trimmedCity);
  return normalizeResponse(
    payload,
    center,
    "city",
    label,
    buildCityEyeCareMapsUrl(label)
  );
};