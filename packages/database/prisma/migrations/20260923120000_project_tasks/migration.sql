CREATE TABLE "Project" (
 "id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "customer" TEXT NOT NULL, "owner" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'Actief',
 CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
CREATE TABLE "ProjectTask" (
 "id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '', "assignee" TEXT NOT NULL DEFAULT '',
 "priority" TEXT NOT NULL DEFAULT 'NORMAL', "status" TEXT NOT NULL DEFAULT 'TODO',
 "dueDate" DATE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ProjectTask_status_check" CHECK ("status" IN ('TODO','IN_PROGRESS','BLOCKED','DONE')),
 CONSTRAINT "ProjectTask_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH'))
);
CREATE INDEX "ProjectTask_projectId_status_idx" ON "ProjectTask"("projectId", "status");
