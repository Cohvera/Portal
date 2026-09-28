import { currentActor, membership } from "../auth/context";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  StreamableFile,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";
import {
  completionIssues,
  documentCategories,
  inspectionStatuses,
  InspectionData,
  nextCycleAvailable,
  newInspection,
  validateInspection,
} from "@cohvera/contracts";

const fieldLabels: Record<string, string> = {
  title: "titel",
  customer: "klant",
  address: "adres",
  contactEmail: "e-mailadres",
  phone: "telefoon",
  type: "keuringstype",
  owner: "verantwoordelijke",
  inspector: "keurder",
  status: "status",
  plannedDate: "plandatum",
  plannedTime: "tijdstip",
  round: "ronde",
  inspectedDate: "keuringsdatum",
  nextDate: "volgende datum",
  intervalMonths: "interval",
  reportNumber: "rapportnummer",
  projectFolder: "projectmap",
  ean: "EAN",
  grounding: "aardingsweerstand",
  notes: "notities",
  checklist: "voorbereiding",
  followUps: "opvolgacties",
};
const documentSelect = {
  id: true,
  name: true,
  category: true,
  mime: true,
  size: true,
  createdAt: true,
} as const;
const include = {
  documents: {
    select: documentSelect,
    orderBy: { createdAt: "desc" as const },
  },
  events: { orderBy: { createdAt: "desc" as const }, take: 200 },
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Ongeldige aanvraag.");
  return value as Record<string, unknown>;
}
function input(value: unknown) {
  try {
    return validateInspection(value);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}
function version(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new BadRequestException(
      "Dossierversie ontbreekt. Herlaad het dossier.",
    );
  return Number(value);
}

@Controller("companies/:companyCode/inspections")
export class InspectionsController {
  private async access(code: string, write = false) {
    const m = membership(
      code,
      write ? "inspections.write" : "inspections.read",
    );
    const selection = await prisma.toolCatalog.findUnique({
      where: { id: "inspections" },
    });
    if (selection && !selection.companyCodes.includes(code))
      throw new ForbiddenException(
        "Keuringen is niet beschikbaar voor dit bedrijf.",
      );
    return { company: m.company, actor: currentActor() };
  }

  private async find(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    const row = await tx.inspection.findFirst({
      where: { id, companyId },
      include,
    });
    if (!row)
      throw new NotFoundException(
        "Keuringsdossier niet gevonden binnen dit bedrijf.",
      );
    return row;
  }
  private async lock(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
    v: unknown,
  ) {
    const result = await tx.inspection.updateMany({
      where: { id, companyId, version: version(v) },
      data: { version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException(
        "Dit dossier is ondertussen gewijzigd. Herlaad het dossier voordat je opnieuw opslaat.",
      );
  }
  private async event(
    tx: Prisma.TransactionClient,
    companyId: string,
    actor: { id: string; displayName: string },
    id: string,
    action: string,
    detail: string,
  ) {
    await tx.inspectionEvent.create({
      data: { inspectionId: id, actor: actor.displayName, action, detail },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        userId: actor.id,
        pluginId: "inspections",
        entityType: "inspection",
        entityId: id,
        action: `inspection.${action}`,
        metadata: { detail },
      },
    });
  }
  @Get()
  async list(@Param("companyCode") code: string) {
    const { company } = await this.access(code);
    return prisma.inspection.findMany({
      where: { companyId: company.id },
      include,
      orderBy: { updatedAt: "desc" },
    });
  }
  @Post()
  async create(@Param("companyCode") code: string, @Body() body: unknown) {
    const { company, actor } = await this.access(code, true),
      data = input(object(body).data);
    if (data.status !== "DRAFT")
      throw new BadRequestException(
        "Een nieuw dossier start in voorbereiding.",
      );
    return prisma.$transaction(async (tx) => {
      const row = await tx.inspection.create({
        data: {
          companyId: company.id,
          data: data as unknown as Prisma.InputJsonValue,
        },
      });
      await this.event(
        tx,
        company.id,
        actor,
        row.id,
        "created",
        "Dossier aangemaakt",
      );
      return this.find(tx, company.id, row.id);
    });
  }
  @Patch(":id")
  async update(
    @Param("companyCode") code: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { company, actor } = await this.access(code, true),
      b = object(body),
      data = input(b.data);
    return prisma.$transaction(async (tx) => {
      await this.lock(tx, company.id, id, b.version);
      const old = await this.find(tx, company.id, id);
      const issues = completionIssues(data, old.documents, today());
      if (issues.length) throw new BadRequestException(issues.join(" "));
      const previous = old.data as unknown as InspectionData;
      const changed = Object.keys(data).filter(
        (k) =>
          JSON.stringify(data[k as keyof InspectionData]) !==
          JSON.stringify(previous[k as keyof InspectionData]),
      );
      if (!changed.length)
        throw new BadRequestException("Geen wijzigingen om op te slaan.");
      const reason = typeof b.reason === "string" ? b.reason.trim() : "";
      if (reason.length > 1000)
        throw new BadRequestException("Reden is te lang.");
      if (
        ((changed.includes("status") &&
          ["ARCHIVED", "OUT_OF_SERVICE"].includes(data.status)) ||
          ["CONFORM", "REINSPECTION", "ARCHIVED", "OUT_OF_SERVICE"].includes(
            previous.status,
          )) &&
        !reason
      )
        throw new BadRequestException(
          "Geef een reden voor het wijzigen of afsluiten van dit dossier.",
        );
      await tx.inspection.update({
        where: { id },
        data: { data: data as unknown as Prisma.InputJsonValue },
      });
      await this.event(
        tx,
        company.id,
        actor,
        id,
        "updated",
        `${inspectionStatuses[previous.status]} → ${inspectionStatuses[data.status]}; bijgewerkt: ${changed.map((k) => fieldLabels[k] || k).join(", ")}${reason ? `. Reden: ${reason}` : ""}`,
      );
      return this.find(tx, company.id, id);
    });
  }
  @Post(":id/next-cycle")
  async next(
    @Param("companyCode") code: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { company, actor } = await this.access(code, true),
      b = object(body);
    try {
      return await prisma.$transaction(async (tx) => {
        await this.lock(tx, company.id, id, b.version);
        const source = await this.find(tx, company.id, id),
          d = source.data as unknown as InspectionData;
        if (!nextCycleAvailable(d, today()))
          throw new BadRequestException(
            "Voorbereiden kan vanaf drie maanden vóór de volgende datum, of bij een herkeuring.",
          );
        if (await tx.inspection.findUnique({ where: { previousId: id } }))
          throw new ConflictException(
            "Er bestaat al een vervolgdossier voor deze cyclus.",
          );
        const data = {
          ...newInspection(),
          title: `${d.status === "REINSPECTION" ? "Herkeuring" : "Periodiek"} · ${d.customer}`,
          customer: d.customer,
          address: d.address,
          contactEmail: d.contactEmail,
          phone: d.phone,
          type: d.type,
          owner: d.owner,
          inspector: d.inspector,
          intervalMonths: d.intervalMonths,
          projectFolder: d.projectFolder,
          ean: d.ean,
          plannedDate: d.status === "CONFORM" ? d.nextDate : "",
          followUps:
            d.status === "REINSPECTION"
              ? d.followUps.filter((f) => !f.done)
              : [],
        };
        const row = await tx.inspection.create({
          data: {
            companyId: company.id,
            previousId: id,
            data: data as unknown as Prisma.InputJsonValue,
          },
        });
        await this.event(
          tx,
          company.id,
          actor,
          id,
          "cycle.prepared",
          `Vervolgdossier aangemaakt: ${row.id}`,
        );
        await this.event(
          tx,
          company.id,
          actor,
          row.id,
          "created",
          `Nieuwe cyclus vanuit ${id}; vorige resultaten en documenten blijven bewaard.`,
        );
        return this.find(tx, company.id, row.id);
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException("Er bestaat al een vervolgdossier.");
      throw e;
    }
  }
  @Post(":id/documents")
  async upload(
    @Param("companyCode") code: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { company, actor } = await this.access(code, true),
      b = object(body);
    if (
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 200 ||
      typeof b.category !== "string" ||
      !(documentCategories as readonly string[]).includes(b.category) ||
      typeof b.content !== "string" ||
      b.content.length > 5600000 ||
      b.content.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(b.content)
    )
      throw new BadRequestException(
        "Ongeldig document. Gebruik een PDF, PNG of JPG van maximaal 4 MB.",
      );
    const content = Buffer.from(b.content, "base64"),
      name = b.name.replace(/[\x00-\x1f\x7f/\\]/g, "_");
    if (!content.length || content.length > 4 * 1024 * 1024)
      throw new BadRequestException("Maximaal 4 MB per document.");
    const mime =
      content.subarray(0, 5).toString() === "%PDF-"
        ? "application/pdf"
        : content
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : content[0] === 255 && content[1] === 216 && content[2] === 255
            ? "image/jpeg"
            : null;
    if (!mime)
      throw new BadRequestException(
        "Alleen PDF, PNG en JPG worden ondersteund.",
      );
    return prisma.$transaction(async (tx) => {
      await this.lock(tx, company.id, id, b.version);
      const row = await this.find(tx, company.id, id),
        d = row.data as unknown as InspectionData;
      if (["ARCHIVED", "OUT_OF_SERVICE"].includes(d.status))
        throw new BadRequestException(
          "Heropen het dossier voordat je documenten toevoegt.",
        );
      if (row.documents.length >= 50)
        throw new BadRequestException("Maximaal 50 documenten per dossier.");
      await tx.inspectionDocument.create({
        data: {
          inspectionId: id,
          name,
          category: b.category as string,
          mime,
          size: content.length,
          content,
        },
      });
      await this.event(
        tx,
        company.id,
        actor,
        id,
        "document.added",
        `${name} (${b.category})`,
      );
      return this.find(tx, company.id, id);
    });
  }
  @Get(":id/documents/:documentId")
  async download(
    @Param("companyCode") code: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    const { company } = await this.access(code);
    const doc = await prisma.inspectionDocument.findFirst({
      where: {
        id: documentId,
        inspectionId: id,
        inspection: { companyId: company.id },
      },
    });
    if (!doc) throw new NotFoundException("Document niet gevonden.");
    return new StreamableFile(Buffer.from(doc.content), {
      type: "application/octet-stream",
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.name).replace(/'/g, "%27")}`,
      length: doc.size,
    });
  }
  @Post(":id/documents/:documentId/remove")
  async removeDocument(
    @Param("companyCode") code: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ) {
    const { company, actor } = await this.access(code, true),
      b = object(body);
    if (
      typeof b.reason !== "string" ||
      !b.reason.trim() ||
      b.reason.length > 1000
    )
      throw new BadRequestException("Geef een reden voor verwijderen.");
    return prisma.$transaction(async (tx) => {
      await this.lock(tx, company.id, id, b.version);
      const row = await this.find(tx, company.id, id),
        data = row.data as unknown as InspectionData;
      if (
        ["CONFORM", "REINSPECTION", "ARCHIVED", "OUT_OF_SERVICE"].includes(
          data.status,
        )
      )
        throw new BadRequestException(
          "Heropen het dossier voordat je bewijsstukken verwijdert.",
        );
      const doc = row.documents.find((d) => d.id === documentId);
      if (!doc) throw new NotFoundException("Document niet gevonden.");
      await tx.inspectionDocument.delete({ where: { id: documentId } });
      await this.event(
        tx,
        company.id,
        actor,
        id,
        "document.removed",
        `${doc.name}. Reden: ${b.reason}`,
      );
      return this.find(tx, company.id, id);
    });
  }
}
