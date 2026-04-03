import { apiRequest, apiVersion } from "../../services/api/client";

export interface EditorQueueItem {
  queueId: string;
  storyId: string;
  versionId: string;
  versionNumber: number;
  previousVersionId?: string;
  normalizedUrl: string;
  title: string;
  nearDuplicate: boolean;
  suspiciousAnomaly: boolean;
  duplicateExplanation?: string;
  anomalyExplanation?: string;
  suggestedTargetStoryId?: string;
  mergeTargets?: Array<{
    storyId: string;
    title: string;
    canonicalUrl: string;
    confidence: number;
  }>;
  similarityConfidence?: number | null;
  createdAt: string;
}

export interface DiffField {
  field: string;
  left: string;
  right: string;
  changed: boolean;
}

export async function fetchEditorQueue(csrfToken?: string | null): Promise<EditorQueueItem[]> {
  const response = await apiRequest<{ items: EditorQueueItem[] }>(apiVersion, "/editor-queue", {}, csrfToken);
  return response.items;
}

export async function fetchStoryDiff(
  storyId: string,
  leftVersionId: string,
  rightVersionId: string,
  csrfToken?: string | null
): Promise<DiffField[]> {
  const response = await apiRequest<{ fields: DiffField[] }>(
    apiVersion,
    `/editor-queue/${storyId}/diff?leftVersionId=${encodeURIComponent(leftVersionId)}&rightVersionId=${encodeURIComponent(rightVersionId)}`,
    {},
    csrfToken
  );
  return response.fields;
}

export async function submitMerge(
  payload: {
    incomingVersionId: string;
    targetStoryId?: string;
    strategy: "replace" | "append" | "keep_both";
    note: string;
  },
  csrfToken?: string | null
): Promise<void> {
  await apiRequest(apiVersion, "/editor-queue/merge", { method: "POST", body: JSON.stringify(payload) }, csrfToken);
}

export async function submitRepair(
  versionId: string,
  payload: { note: string },
  csrfToken?: string | null
): Promise<void> {
  await apiRequest(
    apiVersion,
    `/editor-queue/repair/${encodeURIComponent(versionId)}`,
    { method: "POST", body: JSON.stringify(payload) },
    csrfToken
  );
}
