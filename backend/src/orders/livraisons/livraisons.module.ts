import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LivraisonsController } from './livraisons.controller';
import { LivraisonsService } from './livraisons.service';
import { MouvementsModule } from '../../stock/mouvements/mouvements.module';

@Module({
  imports: [MouvementsModule, MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [LivraisonsController],
  providers: [LivraisonsService],
  exports: [LivraisonsService],
})
export class LivraisonsModule {}
