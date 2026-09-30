import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { prisma } from "@cohvera/database";
import type {
  ProjectReferencePageV1,
  ProjectReferenceV1,
} from "@cohvera/contracts";
const fields = {
  id: true,
  name: true,
  owner: true,
  status: true,
  statusColor: true,
} as const;
/** Read-only, session authenticated and company-scoped by the global guard. */
@Controller("v1/companies/:companyCode/projects")
export class ProjectReferencesController {
  @Get()
  async list(
    @Param("companyCode") companyCode: string,
    @Query("q") q?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ProjectReferencePageV1> {
    if (
      (q !== undefined && (typeof q !== "string" || q.length > 200)) ||
      (cursor !== undefined &&
        (typeof cursor !== "string" || cursor.length > 100))
    )
      throw new BadRequestException("Ongeldige zoekopdracht.");
    const rows = await prisma.project.findMany({
      where: {
        company: { code: companyCode },
        ...(q?.trim()
          ? { name: { contains: q.trim(), mode: "insensitive" as const } }
          : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: fields,
      orderBy: { id: "asc" },
      take: 101,
    });
    const projects = rows.slice(0, 100).map((p) => ({ ...p, companyCode }));
    return {
      version: 1,
      projects,
      nextCursor: rows.length > 100 ? projects[projects.length - 1].id : null,
    };
  }
  @Get(":projectId")
  async get(
    @Param("companyCode") companyCode: string,
    @Param("projectId") projectId: string,
  ): Promise<ProjectReferenceV1> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, company: { code: companyCode } },
      select: fields,
    });
    if (!project)
      throw new NotFoundException("Project niet gevonden binnen dit bedrijf.");
    return { ...project, companyCode };
  }
}
