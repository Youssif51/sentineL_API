import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';

@ApiTags('price-history')
@ApiBearerAuth('access-token')
@Controller('tracked-items/:id/price-history')
export class PriceHistoryController {
  constructor(private readonly priceHistory: PriceHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get chart data for one tracked item' })
  getTrackedItemPriceHistory(
    @Param('id') trackedItemId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.priceHistory.getTrackedItemChartData(trackedItemId, tenantId, query.days ?? 30);
  }
}
