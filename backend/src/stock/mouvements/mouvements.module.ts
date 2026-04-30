import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MouvementsController } from './mouvements.controller';
import { MouvementsService } from './mouvements.service';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [MouvementsController],
  providers: [MouvementsService],
  exports: [MouvementsService],
})
export class MouvementsModule {}
