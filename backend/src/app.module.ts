import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArticlesModule } from './stock/articles/articles.module';
import { MouvementsModule } from './stock/mouvements/mouvements.module';
import { EntrepotsModule } from './stock/entrepots/entrepots.module';
import { StockModule } from './stock/stock.module';
import { CommandesModule } from './orders/commandes/commandes.module';
import { LivraisonsModule } from './orders/livraisons/livraisons.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { CommandesTSModule } from './orders/commandes-ts/commandes-ts.module';
import { InventairesModule } from './stock/inventaires/inventaires.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    MouvementsModule,
    EntrepotsModule,
    StockModule,
    CommandesModule,
    LivraisonsModule,
    DashboardModule,
    NotificationsModule,
    UploadsModule,
    CommandesTSModule,
    InventairesModule,
  ],
})
export class AppModule {}
