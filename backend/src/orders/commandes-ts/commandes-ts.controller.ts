import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CommandesTSService } from './commandes-ts.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('commandes-ts')
@UseGuards(JwtAuthGuard)
export class CommandesTSController {
  constructor(private service: CommandesTSService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(dto, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Put(':id/cloturer')
  cloturer(@Param('id') id: string) { return this.service.cloturer(id); }

  @Put('lignes/:ligneId')
  updateLigne(@Param('ligneId') ligneId: string, @Body() dto: any) {
    return this.service.updateLigne(ligneId, dto);
  }

  @Put('repartitions/:repartitionId')
  updateRepartition(@Param('repartitionId') repartitionId: string, @Body() dto: any) {
    return this.service.updateRepartition(repartitionId, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
