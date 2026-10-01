import { createHash, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

/** Dedicated credential: the guard restricts it to project reference reads. */
export function verifyWarehouseKey(value: unknown) {
  const key = process.env.WAREHOUSE_PROJECTS_API_KEY || "";
  const companyCodes = (process.env.WAREHOUSE_PROJECTS_COMPANIES || "")
    .split(",").map((code) => code.trim()).filter(Boolean);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(key) || !companyCodes.length ||
      companyCodes.some((code) => !/^[A-Z0-9_-]{1,32}$/.test(code)))
    throw new ServiceUnavailableException("Warehouse-koppeling is niet geconfigureerd.");
  if (typeof value !== "string" || value.length > 128 ||
      !timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(key).digest()))
    throw new UnauthorizedException("Ongeldige Warehouse-sleutel.");
  return { companyCodes };
}
