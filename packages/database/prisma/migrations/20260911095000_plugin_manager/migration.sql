CREATE TYPE "PluginRuntime" AS ENUM ('BUILTIN', 'EXTERNAL');

ALTER TABLE "Plugin"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "runtime" "PluginRuntime" NOT NULL DEFAULT 'BUILTIN',
  ADD COLUMN "route" TEXT,
  ADD COLUMN "entrypointUrl" TEXT,
  ADD COLUMN "manifestUrl" TEXT,
  ADD COLUMN "sourceUrl" TEXT;
