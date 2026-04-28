import { Controller, Get, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(@Request() req) { return this.service.findByUser(req.user.id); }

  @Get('count')
  count(@Request() req) { return this.service.countNonLues(req.user.id); }

  @Patch(':id/lire')
  marquerLue(@Param('id') id: string) { return this.service.marquerLue(id); }

  @Patch('lire-toutes')
  marquerToutesLues(@Request() req) { return this.service.marquerToutesLues(req.user.id); }
}
