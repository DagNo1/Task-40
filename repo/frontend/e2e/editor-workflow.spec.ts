import { expect, test } from "@playwright/test";

test("ingestion and editor queue require mandatory merge/repair notes", async ({ page }) => {
  const sessionActive = true;

  await page.route("**/api/v*/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/auth/me") && sessionActive) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ userId: "u-editor", username: "editor", roles: ["editor"], permissions: ["stories.review"] })
      });
      return;
    }
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
      return;
    }
    if (path.endsWith("/auth/csrf") && sessionActive) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "csrf-editor" }) });
      return;
    }
    if (path.endsWith("/alerts/dashboard")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ banners: [] }) });
      return;
    }
    if (path.endsWith("/ingestion/url-batch") && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: 1, rejected: 0, duplicates: 0, anomalies: 0 })
      });
      return;
    }
    if (path.endsWith("/editor-queue") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              queueId: "q1",
              storyId: "s1",
              versionId: "v2",
              versionNumber: 2,
              previousVersionId: "v1",
              normalizedUrl: "https://example.local/story",
              title: "Editor Story",
              nearDuplicate: true,
              suspiciousAnomaly: false,
              mergeTargets: [{ storyId: "target1", title: "Target Story", canonicalUrl: "https://example.local/target", confidence: 0.9 }],
              createdAt: new Date().toISOString()
            }
          ]
        })
      });
      return;
    }
    if (path.includes("/editor-queue/") && path.endsWith("/diff")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fields: [] }) });
      return;
    }
    if (path.endsWith("/editor-queue/merge") || path.includes("/editor-queue/repair/")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
      return;
    }

    await route.fulfill({ status: 404, body: "not mocked" });
  });

  await page.goto("/ingestion");
  await expect(page.getByRole("heading", { name: "Ingestion Workspace" })).toBeVisible();
  const textarea = page.locator("textarea[placeholder*='source-a/story-1']");
  await textarea.fill("https://example.local/story");
  await page.getByRole("button", { name: "Submit URL Batch" }).click();
  await expect(page.getByText("Submitted 1 URL for ingestion.")).toBeVisible();

  await page.goto("/editor-queue");
  await expect(page.getByRole("heading", { name: "Editor Queue" })).toBeVisible();

  const acceptMerge = page.getByRole("button", { name: "Accept Merge" });
  const runRepair = page.getByRole("button", { name: "Run Repair" });
  await expect(acceptMerge).toBeDisabled();
  await expect(runRepair).toBeDisabled();

  await page.getByPlaceholder("Explain why this merge strategy is correct").fill("valid merge note");
  await page.getByPlaceholder("Explain why this repair is needed").fill("valid repair note");

  await expect(acceptMerge).toBeEnabled();
  await expect(runRepair).toBeEnabled();
});
