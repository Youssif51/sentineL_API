import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScraperHealthService } from './scraper-health.service';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperHealthController {
  constructor(private health: ScraperHealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Get health status of all scraper adapters' })
  getHealth() {
    return this.health.getStatus();
  }
}
