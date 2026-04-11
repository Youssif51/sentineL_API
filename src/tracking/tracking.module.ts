// src/tracking/tracking.module.ts
import { Module } from '@nestjs/common';
import { TrackedItemsController } from './tracking.controller';
import { TrackedItemsService } from './tracking.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScrapingModule } from '../scraping/scraping.module';

@Module({
  imports: [PrismaModule, ScrapingModule],
  controllers: [TrackedItemsController],
  providers: [TrackedItemsService],
})
export class TrackedItemsModule {}
