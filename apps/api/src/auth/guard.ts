import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { context, membership, portalAdmin } from "./context";
import { publicOrigin } from "./config";
import { QboxImportController, verifyQboxKey } from "../integrations/qbox";
import { verifyWarehouseKey } from "./warehouse-key";
import { verifyServiceToken } from "./service";
import { ProjectReferencesController } from "../project-references";
import { prisma } from "@cohvera/database";
const publicPaths = new Set([
  "/health",
  "/auth/config",
  "/auth/login",
  "/auth/callback",
]);
export const publicAuthPath = (path: string) => publicPaths.has(path);
@Injectable()
export class PortalGuard implements CanActivate {
  async canActivate(exec: ExecutionContext) {
    const req = exec.switchToHttp().getRequest<Request>();
    const path = req.path.replace(/\/$/, "") || "/";
    if (publicAuthPath(path)) return true;
    if (req.headers["x-qbox-key"] !== undefined || exec.getClass() === QboxImportController) {
      if (req.headers.authorization !== undefined || req.headers["x-warehouse-key"] !== undefined)
        throw new UnauthorizedException("Gebruik alleen de Q-box sleutel.");
      verifyQboxKey(req.headers["x-qbox-key"]);
      if (exec.getClass() !== QboxImportController || req.method !== "POST" || !req.is("application/json"))
        throw new ForbiddenException("Deze sleutel mag alleen de Plenion-export importeren.");
      return true;
    }
    if (req.headers.authorization !== undefined || req.headers["x-warehouse-key"] !== undefined) {
      if (req.headers.authorization !== undefined && req.headers["x-warehouse-key"] !== undefined)
        throw new UnauthorizedException("Gebruik één authenticatiemethode.");
      let service: { companyCodes: string[] };
      if (req.headers["x-warehouse-key"] !== undefined) {
        service = verifyWarehouseKey(req.headers["x-warehouse-key"]);
      } else {
        const header = req.headers.authorization!;
        const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(header);
        if (!match || header.length > 32768)
          throw new UnauthorizedException("Gebruik een geldig Bearer-token.");
        service = await verifyServiceToken(match[1]);
      }
      const code = req.params.companyCode;
      if (
        exec.getClass() !== ProjectReferencesController ||
        !["GET", "HEAD"].includes(req.method) ||
        typeof code !== "string" ||
        !service.companyCodes.includes(code)
      )
        throw new ForbiddenException(
          "Deze applicatie mag alleen projecten van toegewezen bedrijven lezen.",
        );
      const company = await prisma.company.findUnique({
        where: { code },
        select: { isActive: true },
      });
      if (!company?.isActive)
        throw new ForbiddenException("Geen toegang tot dit bedrijf.");
      return true;
    }
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
      if (path.includes("/strategy/"))
        permission = write ? "strategy.manage" : "strategy.read";
      else if (path.includes("/inspections"))
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
