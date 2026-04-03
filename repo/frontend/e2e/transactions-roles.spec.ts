import { expect, test } from "@playwright/test";

test("transactions role behavior gates actions and note requirements", async ({ page }) => {
  let actor: "finance" | "auditor" = "finance";
  const sessionActive = true;

  await page.route("**/api/v*/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/auth/me") && sessionActive) {
      if (actor === "finance") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            userId: "u-finance",
            username: "finance",
            roles: ["finance"],
            permissions: ["transactions.read", "finance.review", "finance.refund", "finance.freeze"]
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            userId: "u-auditor",
            username: "auditor",
            roles: ["auditor"],
            permissions: ["transactions.read", "audit.read", "auditor.release_freeze"]
          })
        });
      }
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
      return;
    }

    if (path.endsWith("/auth/csrf")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "csrf-tx" }) });
      return;
    }

    if (path.endsWith("/alerts/dashboard")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ banners: [] }) });
      return;
    }

    if (path.endsWith("/transactions") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "tx-1",
              reference: "TX-1",
              channel: "prepaid_balance",
              totalAmountCents: 2500,
              status: "APPROVED",
              statusExplanation: "Approved",
              storyVersionId: "sv-1",
              refundedCents: 0,
              createdAt: new Date().toISOString()
            }
          ]
        })
      });
      return;
    }

    if (path.endsWith("/transactions/story-versions") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              versionId: "sv-1",
              storyId: "story-1",
              versionNumber: 1,
              title: "Story",
              canonicalUrl: "https://example.local/story",
              source: "wire",
              createdAt: new Date().toISOString()
            }
          ]
        })
      });
      return;
    }

    if (path.includes("/transactions/") && path.endsWith("/history") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transaction: {
            id: "tx-1",
            reference: "TX-1",
            channel: "prepaid_balance",
            totalAmountCents: 2500,
            status: "APPROVED",
            statusExplanation: "Approved",
            storyVersionId: "sv-1",
            refundedCents: 0,
            createdAt: new Date().toISOString()
          },
          statusExplanation: "Approved",
          ledgerEntries: [],
          refunds: [],
          freezes: [],
          storyVersions: [
            {
              versionId: "sv-1",
              storyId: "story-1",
              versionNumber: 1,
              title: "Story",
              canonicalUrl: "https://example.local/story",
              source: "wire",
              createdAt: new Date().toISOString()
            }
          ],
          audits: [],
          lifecycleSummary: "ok"
        })
      });
      return;
    }

    if (path.includes("/transactions/") && request.method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
      return;
    }

    await route.fulfill({ status: 404, body: "not mocked" });
  });

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transactions Workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Charge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Full Refund" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Freeze" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auditor Release" })).toHaveCount(0);

  const approve = page.getByRole("button", { name: "Approve Charge" });
  await expect(approve).toBeDisabled();
  await page.getByPlaceholder("Explain approval/refund/freeze/release decision").fill("valid note text");
  await expect(approve).toBeEnabled();

  actor = "auditor";
  await page.reload();

  await expect(page.getByRole("button", { name: "Auditor Release" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Charge" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Full Refund" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Freeze" })).toHaveCount(0);
});
