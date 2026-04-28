import { Module } from '@nestjs/common';
import { LivraisonsController } from './livraisons.controller';
import { LivraisonsService } from './livraisons.service';
import { MouvementsModule } from '../../stock/mouvements/mouvements.module';

@Module({
  imports: [MouvementsModule],
  controllers: [LivraisonsController],
  providers: [LivraisonsService],
  exports: [LivraisonsService],
})
export class LivraisonsModule {}
