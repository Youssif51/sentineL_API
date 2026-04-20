import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackedItemsService } from '../tracking/tracking.service';
import { CreateTrackedItemDto } from '../tracking/dto/create-tracked-item.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('tracked-items')
@ApiBearerAuth('access-token')
@Controller('tracked-items')
export class TrackedItemsController {
  constructor(private service: TrackedItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Start tracking a product URL' })
  create(@Body() dto: CreateTrackedItemDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id, user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tracked items with latest prices' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.tenant_id);
  }

  @Get('by-product/:productId')
  @ApiOperation({ summary: 'Get one tracked product by product id' })
  findByProduct(
    @Param('productId') productId: string,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.findByProduct(productId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Stop tracking a product' })
  remove(@Param('id') id: string, @CurrentUser('tenant_id') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
