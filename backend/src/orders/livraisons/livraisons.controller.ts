import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { LivraisonsService } from './livraisons.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('livraisons')
@UseGuards(JwtAuthGuard)
export class LivraisonsController {
  constructor(private service: LivraisonsService) {}

  @Get()
  findAll(@Query() filters: any) { return this.service.findAll(filters); }

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post()
  create(@Body() body: any, @Request() req) {
    return this.service.create(body, req.user?.id);
  }

  @Patch(':id/statut')
  updateStatut(@Param('id') id: string, @Body() body: { statut: any; bonLivraisonUrl?: string; bonCommandeUrl?: string }) {
    return this.service.updateStatut(id, body.statut, body);
  }
}
