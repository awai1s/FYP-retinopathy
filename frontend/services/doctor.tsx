import { getToken } from "./storage";

const API_URL = "https://pleasing-perfection-production.up.railway.app";

export const createPrescription = async (
  patientId: string,
  notes: string,
  instructions: string
) => {
  try {
    const token = await getToken();

    const response = await fetch(
      `${API_URL}/api/doctor/prescriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          patientId,
          notes,
          instructions,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      let message = "Failed to create prescription.";

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

    return await response.json();
  } catch (error) {
    console.error("createPrescription error:", error);
    throw error;
  }
};