import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { pluginCatalog } from "@cohvera/plugin-sdk";

@Controller()
class AppController {
  @Get("health") health() { return { status: "ok", service: "cohvera-api" }; }
  @Get("plugins") plugins() { return pluginCatalog; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
