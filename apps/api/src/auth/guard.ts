import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { context, membership, portalAdmin } from "./context";
import { publicOrigin } from "./config";
const publicPaths = new Set([
  "/health",
  "/auth/config",
  "/auth/login",
  "/auth/callback",
]);
export const publicAuthPath = (path: string) => publicPaths.has(path);
@Injectable()
export class PortalGuard implements CanActivate {
  canActivate(exec: ExecutionContext) {
    const req = exec.switchToHttp().getRequest<Request>();
    const path = req.path.replace(/\/$/, "") || "/";
    if (publicAuthPath(path)) return true;
    const ctx = context();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origins =
        ctx.mode === "development"
          ? [publicOrigin(), "http://localhost:3000", "http://127.0.0.1:3000"]
          : [publicOrigin()];
      if (
        (ctx.mode === "entra" || req.headers.origin) &&
        (!req.headers.origin || !origins.includes(req.headers.origin))
      )
        throw new ForbiddenException(
          "Aanvraag afkomstig van een niet-toegestane website.",
        );
      if (path !== "/auth/logout" && !req.is("application/json"))
        throw new ForbiddenException(
          "Gebruik application/json voor wijzigingen.",
        );
    }
    if (
      (path.startsWith("/admin/") && path !== "/admin/access") ||
      ((path === "/catalog" || path.startsWith("/catalog/")) &&
        !["GET", "HEAD"].includes(req.method))
    )
      portalAdmin();
    const code =
      typeof req.params.companyCode === "string"
        ? req.params.companyCode
        : undefined;
    if (code) {
      const write = !["GET", "HEAD"].includes(req.method);
      let permission: string;
      if (path.includes("/inspections"))
        permission = write ? "inspections.write" : "inspections.read";
      else if (path.includes("/tasks"))
        permission = write ? "tasks.manage" : "tasks.read";
      else if (path.includes("/projects"))
        permission =
          req.method === "POST" && path.endsWith("/projects")
            ? "projects.create"
            : write
              ? "projects.manage"
              : "projects.read";
      else if (path.endsWith("/audit")) permission = "audit.read";
      else if (path.endsWith("/notifications"))
        permission = "notifications.read";
      else if (path.includes("/plugins")) permission = "plugins.read";
      else permission = "companies.read";
      // Platform management routes govern assignments, not business data reads.
      if (!path.startsWith("/admin/")) membership(code, permission);
    }
    return true;
  }
}
