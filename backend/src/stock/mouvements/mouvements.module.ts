import { Module } from '@nestjs/common';
import { MouvementsController } from './mouvements.controller';
import { MouvementsService } from './mouvements.service';

@Module({
  controllers: [MouvementsController],
  providers: [MouvementsService],
  exports: [MouvementsService],
})
export class MouvementsModule {}
