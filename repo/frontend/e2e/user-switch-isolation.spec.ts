import { expect, test } from "@playwright/test";

test("user switch clears prior session UI state and action scope", async ({ page }) => {
  let actor: "finance" | "auditor" | "none" = "none";

  await page.route("**/api/v*/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/auth/login") && request.method() === "POST") {
      const payload = JSON.parse(request.postData() ?? "{}");
      actor = payload.username === "auditor" ? "auditor" : "finance";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", csrfToken: "csrf" }) });
      return;
    }

    if (path.endsWith("/auth/logout") && request.method() === "POST") {
      actor = "none";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
      return;
    }

    if (path.endsWith("/auth/me") && actor !== "none") {
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "csrf-rotated" }) });
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
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
          storyVersions: [],
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
  await expect(page.getByText("SentinelDesk Login")).toBeVisible();
  await page.locator(".login-card input").nth(0).fill("finance");
  await page.locator(".login-card input").nth(1).fill("FinanceNow123");
  await page.getByRole("button", { name: "Sign In" }).click();

  const note = page.getByPlaceholder("Explain approval/refund/freeze/release decision");
  await expect(note).toBeVisible();
  await note.fill("sensitive finance note");
  await expect(note).toHaveValue("sensitive finance note");
  await expect(page.getByRole("button", { name: "Approve Charge" })).toBeVisible();

  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByText("SentinelDesk Login")).toBeVisible();

  await page.locator(".login-card input").nth(0).fill("auditor");
  await page.locator(".login-card input").nth(1).fill("AuditorNow123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(note).toBeVisible();
  await expect(note).toHaveValue("");
  await expect(page.getByRole("button", { name: "Approve Charge" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Auditor Release" })).toBeVisible();
});
