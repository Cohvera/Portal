// Removes only the temporary QHOME Plenion import; never deletes linked tasks.
async function undoQhomeImport(prisma, apply = false) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
    const company = await tx.company.findUnique({where:{code:"QHOME"}});
    if (!company) throw new Error("QHOME niet gevonden.");
    const where = {companyId:company.id, externalSource:"PLENION"};
    // Lock projects before inspecting tasks, including offers hidden from the UI.
    await tx.$queryRaw`SELECT id FROM "Project" WHERE "companyId" = ${company.id} AND "externalSource" = 'PLENION' FOR UPDATE`;
    const count = await tx.project.count({where});
    const tasks = await tx.projectTask.count({where:{project:where}});
    if (tasks) throw new Error(`${tasks} gekoppelde taken gevonden. Niets verwijderd; eerst taken veiligstellen.`);
    if (!apply) return {company:"QHOME",projects:count,applied:false};
    const removed = await tx.project.deleteMany({where});
    await tx.qboxImport.deleteMany({where:{companyCode:"QHOME"}});
    return {company:"QHOME",projects:removed.count,applied:true};
  }, {timeout:60000});
}
module.exports = {undoQhomeImport};
if (require.main === module) {
  const {PrismaClient} = require("@prisma/client");
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--apply")) throw new Error("Gebruik zonder argumenten voor controle, of --apply voor verwijderen.");
    return undoQhomeImport(prisma,args[0] === "--apply");
  }).then(result => console.log(JSON.stringify(result)))
    .catch(error => {console.error(error.message);process.exitCode=1;})
    .finally(()=>prisma.$disconnect());
}
