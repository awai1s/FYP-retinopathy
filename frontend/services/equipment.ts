import BASE_URL from "./api";
import { getToken } from "./storage";

export type EquipmentType =
  | "Fundus Camera"
  | "OCT Scanner"
  | "Slit Lamp"
  | "Retinal Laser"
  | "Visual Field Analyzer"
  | "Tonometer"
  | "Other";

export type EquipmentStatus =
  | "Operational"
  | "Service Due"
  | "Calibration Due"
  | "Under Maintenance"
  | "Out of Service"
  | "Retired";

export type StoredEquipmentStatus = "Operational" | "Under Maintenance" | "Out of Service" | "Retired";

export type EquipmentEventType =
  | "SERVICE"
  | "CALIBRATION"
  | "DOWNTIME_START"
  | "DOWNTIME_END"
  | "REPAIR"
  | "STATUS_CHANGE"
  | "RETIREMENT";

export interface DueState {
  date: string;
  days: number | null;
  state: "not_set" | "overdue" | "due_today" | "due_soon" | "upcoming" | "scheduled";
}

export interface EyeEquipment {
  id: string;
  assetId: string;
  deviceName: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  location: string;
  purchaseDate: string;
  status: EquipmentStatus;
  storedStatus: StoredEquipmentStatus;
  lastService: string;
  nextService: string;
  lastCalibration: string;
  nextCalibration: string;
  notes: string;
  serviceDue: DueState;
  calibrationDue: DueState;
  downtimeStartedAt: string;
  retiredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentEvent {
  id: string;
  equipmentId: string;
  eventType: EquipmentEventType;
  eventDate: string;
  nextDueDate: string;
  targetStatus: StoredEquipmentStatus | "";
  performedBy: string;
  reference: string;
  cost: number | null;
  notes: string;
  createdByUserId: string;
  createdAt: string;
}

export interface EquipmentSummary {
  totalDevices: number;
  activeDevices: number;
  operational: number;
  serviceDue: number;
  calibrationDue: number;
  underMaintenance: number;
  outOfService: number;
  retired: number;
  dueWithin7Days: number;
  upcomingDue: Array<{
    equipmentId: string;
    assetId: string;
    deviceName: string;
    kind: "service" | "calibration";
    dueDate: string;
    days: number;
  }>;
}

export interface EquipmentPayload {
  assetId: string;
  deviceName: string;
  type: EquipmentType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  department?: string;
  location?: string;
  purchaseDate?: string;
  status?: StoredEquipmentStatus;
  lastService?: string;
  nextService?: string;
  lastCalibration?: string;
  nextCalibration?: string;
  notes?: string;
}

export interface EquipmentEventPayload {
  eventType: EquipmentEventType;
  eventDate: string;
  nextDueDate?: string;
  targetStatus?: StoredEquipmentStatus;
  performedBy?: string;
  reference?: string;
  cost?: number;
  notes?: string;
}

const headers = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parse = async <T,>(response: Response, fallback: string): Promise<T> => {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item: any) => item?.msg || String(item)).join("\n")
      : data?.detail;
    throw new Error(detail || data?.message || fallback);
  }
  return data as T;
};

export const EQUIPMENT_TYPES: EquipmentType[] = [
  "Fundus Camera",
  "OCT Scanner",
  "Slit Lamp",
  "Retinal Laser",
  "Visual Field Analyzer",
  "Tonometer",
  "Other",
];

export const STORED_EQUIPMENT_STATUSES: StoredEquipmentStatus[] = [
  "Operational",
  "Under Maintenance",
  "Out of Service",
  "Retired",
];

export const EQUIPMENT_DISPLAY_STATUSES: EquipmentStatus[] = [
  "Operational",
  "Service Due",
  "Calibration Due",
  "Under Maintenance",
  "Out of Service",
  "Retired",
];

export async function getEquipmentSummary(): Promise<EquipmentSummary> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment/summary`, { headers: await headers() });
  return parse<EquipmentSummary>(response, "Unable to load equipment summary.");
}

export async function listEquipment(params?: {
  search?: string;
  type?: EquipmentType | "";
  status?: EquipmentStatus | "";
}): Promise<EyeEquipment[]> {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  const response = await fetch(
    `${BASE_URL}/api/hospital/equipment${query.toString() ? `?${query.toString()}` : ""}`,
    { headers: await headers() }
  );
  const data = await parse<{ equipment?: EyeEquipment[] }>(response, "Unable to load equipment.");
  return data.equipment || [];
}

export async function getEquipment(equipmentId: string): Promise<EyeEquipment> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment/${encodeURIComponent(equipmentId)}`, {
    headers: await headers(),
  });
  return parse<EyeEquipment>(response, "Unable to load equipment details.");
}

export async function createEquipment(payload: EquipmentPayload): Promise<EyeEquipment> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ equipment: EyeEquipment }>(response, "Unable to add equipment.");
  return data.equipment;
}

export async function updateEquipment(equipmentId: string, payload: Partial<EquipmentPayload>): Promise<EyeEquipment> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment/${encodeURIComponent(equipmentId)}`, {
    method: "PATCH",
    headers: await headers(),
    body: JSON.stringify(payload),
  });
  const data = await parse<{ equipment: EyeEquipment }>(response, "Unable to update equipment.");
  return data.equipment;
}

export async function listEquipmentEvents(equipmentId: string): Promise<EquipmentEvent[]> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment/${encodeURIComponent(equipmentId)}/events`, {
    headers: await headers(),
  });
  const data = await parse<{ events?: EquipmentEvent[] }>(response, "Unable to load equipment history.");
  return data.events || [];
}

export async function createEquipmentEvent(equipmentId: string, payload: EquipmentEventPayload): Promise<{ equipment: EyeEquipment; event: EquipmentEvent }> {
  const response = await fetch(`${BASE_URL}/api/hospital/equipment/${encodeURIComponent(equipmentId)}/events`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(payload),
  });
  return parse<{ equipment: EyeEquipment; event: EquipmentEvent }>(response, "Unable to save equipment event.");
}
