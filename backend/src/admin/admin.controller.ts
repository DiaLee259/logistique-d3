import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('reset/mouvements')
  resetMouvements() { return this.adminService.resetMouvements(); }

  @Post('reset/inventaires')
  resetInventaires() { return this.adminService.resetInventaires(); }

  @Post('reset/commandes')
  resetCommandes() { return this.adminService.resetCommandes(); }

  @Post('reset/livraisons')
  resetLivraisons() { return this.adminService.resetLivraisons(); }

  @Post('reset/stocks')
  resetStocks() { return this.adminService.resetStocks(); }

  @Post('reset/notifications')
  resetNotifications() { return this.adminService.resetNotifications(); }

  @Post('reset/complet')
  resetComplet() { return this.adminService.resetComplet(); }
}
