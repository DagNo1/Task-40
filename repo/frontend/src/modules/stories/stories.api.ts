import { apiRequest, apiVersion } from "../../services/api/client";

export interface StoryListItem {
  id: string;
  title: string;
  canonicalUrl: string;
  source: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  latestVersionNumber?: number | null;
  latestVersionAt?: string | null;
}

export async function fetchStories(query: string, csrfToken?: string | null): Promise<StoryListItem[]> {
  const qs = new URLSearchParams();
  if (query.trim()) {
    qs.set("q", query.trim());
  }
  const suffix = qs.toString();
  const path = suffix ? `/stories?${suffix}` : "/stories";
  const payload = await apiRequest<{ items: StoryListItem[] }>(apiVersion, path, {}, csrfToken);
  return payload.items;
}
