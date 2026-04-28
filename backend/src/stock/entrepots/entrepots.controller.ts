import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EntrepotsService } from './entrepots.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('entrepots')
@UseGuards(JwtAuthGuard)
export class EntrepotsController {
  constructor(private service: EntrepotsService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return all === 'true' ? this.service.findAllIncludingInactif() : this.service.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  create(@Body() body: { code: string; nom: string; localisation: string; gestionnaire?: string; adresse?: string; telephone?: string; email?: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
