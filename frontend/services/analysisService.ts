export interface AnalysisResult {
  diagnosis: string;
  confidence: number;
  riskLevel: string;
  imageUrl: string;
  clinicalFindings: string[];
  recommendations: string[];
}


export async function getAnalysisResult(): Promise<AnalysisResult> {

  const response = await fetch(
    "YOUR_BACKEND_API_URL/analysis/result"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch analysis result");
  }

  return response.json();
}