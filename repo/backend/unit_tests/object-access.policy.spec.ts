import { ForbiddenException } from "@nestjs/common";
import {
  ensureActorObjectAccess,
  hasAdminOverride
} from "../src/common/authz/object-access.policy";

describe("object access policy", () => {
  it("allows owner access", () => {
    expect(() =>
      ensureActorObjectAccess(
        { userId: "u1", permissions: ["transactions.read"] },
        { ownerIds: ["u1"], context: "transaction" }
      )
    ).not.toThrow();
  });

  it("allows admin override", () => {
    expect(hasAdminOverride({ userId: "u1", permissions: ["admin.manage"] })).toBe(true);
    expect(() =>
      ensureActorObjectAccess(
        { userId: "u1", permissions: ["admin.manage"] },
        { ownerIds: ["someone-else"], context: "transaction" }
      )
    ).not.toThrow();
  });

  it("rejects non-owner access", () => {
    expect(() =>
      ensureActorObjectAccess(
        { userId: "u2", permissions: ["transactions.read"] },
        { ownerIds: ["u1"], context: "transaction" }
      )
    ).toThrow(ForbiddenException);
  });

  it("allows access when explicit permission override is configured", () => {
    expect(() =>
      ensureActorObjectAccess(
        { userId: "auditor", permissions: ["auditor.release_freeze"] },
        {
          ownerIds: ["u1"],
          context: "transaction history",
          allowIfAnyPermission: ["auditor.release_freeze"]
        }
      )
    ).not.toThrow();
  });
});
