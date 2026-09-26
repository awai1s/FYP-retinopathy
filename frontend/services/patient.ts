import { getToken } from "./storage";
import BASE_URL from "./api";
import { isLikelyNetworkError, readOfflineCache, writeOfflineCache } from "./offlineCache";

export interface DashboardStats {
  eyeHealth: string;
  reports: string;
  predictions: string;
  doctors: string;
}

export interface DashboardPrediction {
  id: string;
  stage: string;
  confidence: string;
  date: string;
  status: "Completed" | "Pending" | "Processing" | "Failed";
  riskScore?: number | null;
}

export interface DashboardReport {
  id: string;
  title: string;
  date: string;
  status: "Completed" | "Pending" | "Processing";
}

export interface PatientDashboard {
  stats: DashboardStats;
  latestPrediction: DashboardPrediction | null;
  recentReports: DashboardReport[];
}

export interface HistoryItem {
  id: string;
  title: string;
  date: string;
  status: string;
  type?: string;
  result?: string;
  confidence?: string;
}

export type PredictionStatus = "Pending" | "Processing" | "Completed" | "Failed";

export interface PredictionResult {
  id: string;
  predictionId: string;
  status: PredictionStatus;
  diagnosis: string;
  stage: string;
  confidence: string;
  riskLevel: string;
  riskScore: number | null;
  findings: string[];
  recommendations: string[];
  gradCam: unknown | null;
  fileId?: string;
  fileName?: string;
  createdAt?: string;
}

export interface PatientUploadResponse {
  message?: string;
  type: "document" | "retinal_image";
  reportId?: string;
  predictionId?: string;
  status?: PredictionStatus;
}

export interface CareNavigationPayload {
  clinicId?: string;
  clinicName: string;
  address?: string;
  action?: "Viewed" | "Directions";
  searchMode?: "nearby" | "city";
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Get patient dashboard data
 */
export const getPatientDashboard = async (): Promise<PatientDashboard> => {
  try {
    const token = await getToken();

    const response = await fetch(
      `${BASE_URL}/api/patient/dashboard`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      let message = "Failed to load patient dashboard.";

      try {
        const errorData = JSON.parse(errorText);

        message =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          message;
      } catch {
        if (errorText) {
          message = errorText;
        }
      }

      const error: any = new Error(message);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    const normalized: PatientDashboard = {
      stats: {
        eyeHealth:
          data.stats?.eyeHealth ||
          data.stats?.eye_health ||
          "Checking...",

        reports: String(
          data.stats?.reports ??
            data.stats?.totalReports ??
            0
        ),

        predictions: String(
          data.stats?.predictions ??
            data.stats?.totalPredictions ??
            0
        ),

        doctors: String(
          data.stats?.doctors ??
            data.stats?.totalDoctors ??
            0
        ),
      },

      latestPrediction: data.latestPrediction
        ? {
            id: String(
              data.latestPrediction.id ||
                data.latestPrediction.predictionId ||
                ""
            ),

            stage:
              data.latestPrediction.stage ||
              data.latestPrediction.disease ||
              (["Pending", "Processing"].includes(data.latestPrediction.status)
                ? "Screening submitted"
                : "Analysis"),

            confidence:
              data.latestPrediction.confidence !== undefined &&
              data.latestPrediction.confidence !== null &&
              String(data.latestPrediction.confidence).trim()
                ? String(data.latestPrediction.confidence)
                : "—",

            date:
              data.latestPrediction.date ||
              data.latestPrediction.createdAt ||
              "Recent",

            status:
              data.latestPrediction.status ||
              "Completed",

            riskScore:
              data.latestPrediction.riskScore ??
              data.latestPrediction.risk_score ??
              null,
          }
        : null,

      recentReports: Array.isArray(data.recentReports)
        ? data.recentReports.map(
            (report: any) => ({
              id: String(
                report.id ||
                  report.reportId ||
                  ""
              ),

              title:
                report.title ||
                report.name ||
                "Clinical Report",

              date:
                report.date ||
                report.createdAt ||
                "Recent",

              status:
                report.status ||
                "Completed",
            })
          )
        : [],
    };
    // Cache a deliberately small patient summary: counts + latest screening only.
    await writeOfflineCache("patient-dashboard", { ...normalized, recentReports: [] });
    return normalized;
  } catch (error) {
    const cached = isLikelyNetworkError(error)
      ? await readOfflineCache<PatientDashboard>("patient-dashboard")
      : null;
    if (cached) return cached;
    console.error("getPatientDashboard error:", error);
    throw error;
  }
};

/**
 * Get patient medical/history records
 */
export const getPatientHistory =
  async (): Promise<HistoryItem[]> => {
    try {
      const token = await getToken();

      const response = await fetch(
        `${BASE_URL}/api/patient/history`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        let message =
          "Failed to load patient history.";

        try {
          const errorData = JSON.parse(errorText);

          message =
            errorData.detail ||
            errorData.message ||
            errorData.error ||
            message;
        } catch {
          if (errorText) {
            message = errorText;
          }
        }

        const error: any = new Error(message);
      error.status = response.status;
      throw error;
      }

      const data = await response.json();

      const history = Array.isArray(data)
        ? data
        : data.history ||
          data.records ||
          data.results ||
          [];

      return history.map(
        (item: any): HistoryItem => ({
          id: String(
            item.id ||
              item.recordId ||
              item.reportId ||
              ""
          ),

          title:
            item.title ||
            item.name ||
            item.reportName ||
            "Medical Record",

          date:
            item.date ||
            item.createdAt ||
            item.created_at ||
            "Recent",

          status:
            item.status ||
            "Completed",

          type:
            item.type ||
            item.reportType ||
            "",

          result:
            item.result ||
            item.prediction ||
            "",

          confidence:
            item.confidence ||
            "",
        })
      );
    } catch (error) {
      console.error(
        "getPatientHistory error:",
        error
      );

      throw error;
    }
  };

/**
 * Get patient AI prediction result
 */
export const getPredictionResult = async (
  predictionId: string
): Promise<PredictionResult> => {
  try {
    const token = await getToken();

    const response = await fetch(
      `${BASE_URL}/api/patient/predictions/${encodeURIComponent(predictionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let message = "Failed to load prediction result.";

      try {
        const errorData = JSON.parse(errorText);
        message =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          message;
      } catch {
        if (errorText) message = errorText;
      }

      const error: any = new Error(message);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const rawStatus = String(data.status || "Completed").trim().toLowerCase();
    const status: PredictionStatus =
      rawStatus === "pending"
        ? "Pending"
        : rawStatus === "processing"
          ? "Processing"
          : rawStatus === "failed"
            ? "Failed"
            : "Completed";

    const stage = String(
      data.stage ||
      data.diagnosis ||
      data.prediction ||
      data.result ||
      data.disease ||
      ""
    );

    const rawRiskScore =
      data.riskScore ??
      data.risk_score ??
      (typeof data.risk === "number" ? data.risk : data.risk?.score);
    const parsedRiskScore = rawRiskScore == null || rawRiskScore === "" ? NaN : Number(rawRiskScore);
    const riskScore = Number.isFinite(parsedRiskScore) ? parsedRiskScore : null;

    const rawId = String(data.predictionId || data.id || predictionId);

    return {
      id: rawId,
      predictionId: rawId,
      status,
      diagnosis: stage || (status === "Completed" ? "Unknown" : ""),
      stage,
      confidence:
        data.confidence !== undefined && data.confidence !== null
          ? String(data.confidence)
          : "",
      riskLevel: String(data.riskLevel || data.risk_level || ""),
      riskScore,
      findings: Array.isArray(data.findings)
        ? data.findings.map(String)
        : data.findings
          ? [String(data.findings)]
          : [],
      recommendations: Array.isArray(data.recommendations)
        ? data.recommendations.map(String)
        : data.recommendations
          ? [String(data.recommendations)]
          : [],
      gradCam:
        data.gradCam ??
        data.gradCAM ??
        data.gradcam ??
        data.gradCamUrl ??
        data.heatmap ??
        null,
      fileId: data.fileId ? String(data.fileId) : undefined,
      fileName: data.fileName ? String(data.fileName) : undefined,
      createdAt: String(data.createdAt || data.created_at || data.date || ""),
    };
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      const cached = await readOfflineCache<PatientDashboard>("patient-dashboard");
      const latest = cached?.latestPrediction;
      if (latest && (!predictionId || latest.id === predictionId)) {
        return {
          id: latest.id,
          predictionId: latest.id,
          status: latest.status,
          diagnosis: latest.stage,
          stage: latest.stage,
          confidence: latest.confidence,
          riskLevel: "",
          riskScore: latest.riskScore ?? null,
          findings: [],
          recommendations: ["Offline summary only. Reconnect to load the complete screening result."],
          gradCam: null,
          createdAt: latest.date,
        };
      }
    }
    console.error("getPredictionResult error:", error);
    throw error;
  }
};

/**
 * Upload patient report
 */
export const uploadPatientReport =
  async (formData: FormData): Promise<PatientUploadResponse> => {
    try {
      const token = await getToken();

      const response = await fetch(
        `${BASE_URL}/api/patient/upload`,
        {
          method: "POST",
          headers: {
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        let message =
          "Failed to upload patient report.";

        try {
          const errorData = JSON.parse(errorText);

          message =
            errorData.detail ||
            errorData.message ||
            errorData.error ||
            message;
        } catch {
          if (errorText) {
            message = errorText;
          }
        }

        throw new Error(message);
      }

      const data = await response.json();

      const inferredType: "document" | "retinal_image" =
        data.type === "retinal_image" || data.predictionId
          ? "retinal_image"
          : "document";

      return {
        ...data,
        type: inferredType,
        reportId: data.reportId ? String(data.reportId) : undefined,
        predictionId: data.predictionId ? String(data.predictionId) : undefined,
        status: data.status as PredictionStatus | undefined,
      };
    } catch (error) {
      console.error(
        "uploadPatientReport error:",
        error
      );

      throw error;
    }
  };

/**
 * Record an explicit Clinic Locator action in the existing patient history.
 * This call is intentionally best-effort from the UI; map navigation must not
 * be blocked if the activity log endpoint is temporarily unavailable.
 */
export const recordCareNavigation = async (
  payload: CareNavigationPayload
): Promise<void> => {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/api/patient/care-navigation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to record care-navigation activity."
    );
  }
};
