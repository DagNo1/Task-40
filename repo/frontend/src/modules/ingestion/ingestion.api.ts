import { apiRequest, apiVersion } from "../../services/api/client";

export interface IngestionResult {
  accepted: number;
  rejected: number;
  duplicates: number;
  anomalies: number;
  stories: Array<{
    storyId: string;
    versionId: string;
    clusterId?: string;
    duplicate: boolean;
    anomaly: boolean;
    explanation: string;
  }>;
  thresholds?: {
    simhashMaxHamming: number;
    minhashMinSimilarity: number;
  };
}

export async function uploadIngestionFile(
  payload: { source: string; file: File },
  csrfToken?: string | null
): Promise<IngestionResult> {
  const formData = new FormData();
  formData.append("source", payload.source);
  formData.append("file", payload.file);
  return apiRequest<IngestionResult>(
    apiVersion,
    "/ingestion/upload",
    {
      method: "POST",
      body: formData
    },
    csrfToken
  );
}

export async function submitUrlBatch(
  payload: { source: string; urls: string[] },
  csrfToken?: string | null
): Promise<IngestionResult> {
  return apiRequest<IngestionResult>(
    apiVersion,
    "/ingestion/url-batch",
    { method: "POST", body: JSON.stringify(payload) },
    csrfToken
  );
}
