import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { prisma } from "@cohvera/database";

const members = ["Remko", "Milan", "Sofie", "Thomas"];
function taskInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("Ongeldige taak.");
  const b = body as Record<string, unknown>;
  const text = (key: string, max: number, fallback?: string) => {
    const value = b[key] ?? fallback;
    if (typeof value !== "string" || value.length > max) throw new BadRequestException(`Ongeldig veld: ${key}`);
    return value.trim();
  };
  const title = text("title", 200);
  if (!title) throw new BadRequestException("Vul een titel in.");
  const description = text("description", 10000, "");
  const assignee = text("assignee", 100, "");
  const status = text("status", 30, "TODO");
  const priority = text("priority", 30, "NORMAL");
  if (assignee && !members.includes(assignee)) throw new BadRequestException("Onbekend teamlid.");
  if (!["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(status)) throw new BadRequestException("Ongeldige status.");
  if (!["LOW", "NORMAL", "HIGH"].includes(priority)) throw new BadRequestException("Ongeldige prioriteit.");
  let dueDate: Date | null = null;
  if (b.dueDate !== undefined && b.dueDate !== null && b.dueDate !== "") {
    if (typeof b.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new BadRequestException("Ongeldige deadline.");
    dueDate = new Date(`${b.dueDate}T00:00:00.000Z`);
    if (!Number.isFinite(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== b.dueDate) throw new BadRequestException("Ongeldige deadline.");
  }
  return {title, description, assignee, status, priority, dueDate};
}

function projectInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("Ongeldig project.");
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 200) throw new BadRequestException("Vul een titel in van maximaal 200 tekens.");
  if (typeof b.owner !== "string" || !members.includes(b.owner)) throw new BadRequestException("Kies een verantwoordelijke.");
  if (typeof b.status !== "string" || !["Gepland", "Actief", "Gepauzeerd", "Afgerond"].includes(b.status)) throw new BadRequestException("Kies een geldige status.");
  if (typeof b.statusColor !== "string" || !/^#[0-9a-f]{6}$/i.test(b.statusColor)) throw new BadRequestException("Kies een geldige statuskleur.");
  let dueDate: Date | null = null;
  if (b.dueDate !== null && b.dueDate !== undefined && b.dueDate !== "") {
    if (typeof b.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new BadRequestException("Ongeldige deadline.");
    dueDate = new Date(`${b.dueDate}T00:00:00.000Z`);
    if (!Number.isFinite(dueDate.getTime()) || dueDate.toISOString().slice(0,10) !== b.dueDate) throw new BadRequestException("Ongeldige deadline.");
  }
  return {name: b.name.trim(), owner: b.owner, status: b.status, statusColor: b.statusColor, dueDate};
}

@Controller("companies/:companyCode")
export class ProjectsController {
  private async project(companyCode: string, projectId: string) {
    const project = await prisma.project.findFirst({where: {id: projectId, company: {code: companyCode}}});
    if (!project) throw new NotFoundException("Project niet gevonden binnen dit bedrijf.");
    return project;
  }
  @Get("projects")
  async projects(@Param("companyCode") companyCode: string) {
    return prisma.project.findMany({where: {company: {code: companyCode}}, include: {tasks: {orderBy: {createdAt: "desc"}}}, orderBy: {name: "asc"}});
  }
  @Post("projects")
  async createProject(@Param("companyCode") code: string, @Body() body: unknown) {
    const data = projectInput(body);
    const company = await prisma.company.findUnique({where: {code}});
    if (!company || !company.isActive) throw new NotFoundException("Bedrijf niet gevonden.");
    return prisma.project.create({data: {...data, companyId: company.id, customer: ""}, include: {tasks: true}});
  }
  @Patch("projects/:projectId")
  async updateProject(@Param("companyCode") code: string, @Param("projectId") id: string, @Body() body: unknown) {
    const data = projectInput(body);
    await this.project(code, id);
    return prisma.project.update({where: {id}, data, include: {tasks: true}});
  }
  @Post("projects/:projectId/tasks")
  async create(@Param("companyCode") code: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const data = taskInput(body);
    await this.project(code, projectId);
    return prisma.projectTask.create({data: {...data, projectId}});
  }
  @Patch("projects/:projectId/tasks/:taskId")
  async update(@Param("companyCode") code: string, @Param("projectId") projectId: string, @Param("taskId") id: string, @Body() body: unknown) {
    const data = taskInput(body);
    await this.project(code, projectId);
    const result = await prisma.projectTask.updateMany({where: {id, projectId}, data});
    if (!result.count) throw new NotFoundException("Taak niet gevonden.");
    return {updated: true};
  }
  @Delete("projects/:projectId/tasks/:taskId")
  async remove(@Param("companyCode") code: string, @Param("projectId") projectId: string, @Param("taskId") id: string) {
    await this.project(code, projectId);
    const result = await prisma.projectTask.deleteMany({where: {id, projectId}});
    if (!result.count) throw new NotFoundException("Taak niet gevonden.");
    return {deleted: true};
  }
}
