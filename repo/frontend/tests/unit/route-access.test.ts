import { describe, expect, it } from "vitest";
import {
  hasRoutePermission,
  resolveNearestAllowedPath
} from "../../src/app/router/route-access";

describe("route permission access", () => {
  it("blocks unauthorized deep-link to admin and redirects to nearest allowed page", () => {
    const permissions = ["transactions.read"];
    expect(hasRoutePermission("/admin", permissions)).toBe(false);
    expect(resolveNearestAllowedPath(permissions)).toBe("/transactions");
  });

  it("defaults unauthorized users to security page", () => {
    expect(resolveNearestAllowedPath([])).toBe("/security");
  });

  it("allows admin override to any permission-protected route", () => {
    const permissions = ["admin.manage"];
    expect(hasRoutePermission("/alerts", permissions)).toBe(true);
    expect(resolveNearestAllowedPath(permissions)).toBe("/editor-queue");
  });
});
