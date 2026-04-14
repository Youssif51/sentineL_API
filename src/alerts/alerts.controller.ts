import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertRulesService } from './alerts.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('alert-rules')
@ApiBearerAuth('access-token')
@Controller('alert-rules')
export class AlertRulesController {
  constructor(private service: AlertRulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an alert rule' })
  create(@Body() dto: CreateAlertRuleDto, @CurrentUser('tenant_id') tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all alert rules' })
  findAll(@CurrentUser('tenant_id') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an alert rule threshold' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
    @CurrentUser('tenant_id') tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an alert rule' })
  remove(@Param('id') id: string, @CurrentUser('tenant_id') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
