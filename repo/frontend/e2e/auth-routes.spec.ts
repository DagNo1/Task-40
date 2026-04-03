import { expect, test } from "@playwright/test";

test("login and deep-link redirects respect role permissions", async ({ page }) => {
  let actor: "auditor" | "admin" | "none" = "auditor";

  await page.route("**/api/v*/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/auth/login") && request.method() === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      actor = body.username === "admin" ? "admin" : "auditor";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", csrfToken: "csrf-login" }) });
      return;
    }

    if (path.endsWith("/auth/me") && actor !== "none") {
      const session =
        actor === "auditor"
          ? {
              userId: "u-audit",
              username: "auditor",
              roles: ["auditor"],
              permissions: ["audit.read", "transactions.read", "auditor.release_freeze"]
            }
          : {
              userId: "u-admin",
              username: "admin",
              roles: ["admin"],
              permissions: ["admin.manage"]
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session)
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
      return;
    }

    if (path.endsWith("/auth/csrf") && actor !== "none") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "csrf-rotated" }) });
      return;
    }

    if (path.endsWith("/auth/logout") && actor !== "none") {
      actor = "none";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
      return;
    }

    if (path.endsWith("/alerts/dashboard")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ banners: [] }) });
      return;
    }

    if (path.endsWith("/reports/audit")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }

    if (path.includes("/transactions") || path.includes("/editor-queue") || path.includes("/stories") || path.includes("/ingestion")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }

    await route.fulfill({ status: 404, body: "not mocked" });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Transactions Workspace" })).toBeVisible();

  actor = "none";
  await page.reload();
  await expect(page.getByText("SentinelDesk Login")).toBeVisible();

  await page.locator(".login-card input").nth(0).fill("admin");
  await page.locator(".login-card input").nth(1).fill("AdminPass123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Editor Queue" })).toBeVisible();

  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Alerts Dashboard" })).toBeVisible();
});
