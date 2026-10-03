import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
} from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";
import {
  initialProcess,
  processDefinitions,
  validateProcessMetadata,
} from "@cohvera/contracts";
import { allowedCompanies, portalAdmin } from "./auth/context";

@Controller("processes")
export class ProcessesController {
  @Get()
  async overview() {
    // These are shared group standards, accessible to authenticated company members.
    if (!allowedCompanies().length)
      throw new ForbiddenException("Geen bedrijfstoegang toegewezen.");
    const rows = await prisma.processRegister.findMany();
    return processDefinitions.map((definition) => {
      const row = rows.find((r) => r.id === definition.id);
      return row
        ? { ...definition, ...row, updatedAt: row.updatedAt.toISOString() }
        : initialProcess(definition);
    });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const actor = portalAdmin();
    const definition = processDefinitions.find((p) => p.id === id);
    if (!definition) throw new BadRequestException("Onbekend bedrijfsproces.");
    let input;
    try {
      input = validateProcessMetadata(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (id !== "BP-02" && input.methodologyUrl)
      throw new BadRequestException(
        "De CPM-verwijzing hoort bij Order to Delivery.",
      );
    const { version, ...data } = input;
    try {
      return await prisma.$transaction(async (tx) => {
        if (version === 0) {
          await tx.processRegister.create({ data: { id, ...data } });
        } else {
          const result = await tx.processRegister.updateMany({
            where: { id, version },
            data: { ...data, version: { increment: 1 } },
          });
          if (!result.count)
            throw new ConflictException(
              "Dit proces is ondertussen gewijzigd. Herlaad het overzicht vóór je opnieuw opslaat.",
            );
        }
        const row = await tx.processRegister.findUniqueOrThrow({
          where: { id },
        });
        const company = await tx.company.findUniqueOrThrow({
          where: { code: "COH" },
        });
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: actor.id,
            entityType: "process",
            entityId: id,
            action: "process.updated",
            metadata: {
              version: row.version,
              status: row.status,
              health: row.health,
            },
          },
        });
        return {
          ...definition,
          ...row,
          updatedAt: row.updatedAt.toISOString(),
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException(
          "Dit proces is ondertussen gewijzigd. Herlaad het overzicht vóór je opnieuw opslaat.",
        );
      throw e;
    }
  }
}
