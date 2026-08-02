import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MouvementsController } from './mouvements.controller';
import { MouvementsService } from './mouvements.service';
import { StockCalculatorService } from '../stock-calculator.service';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [MouvementsController],
  providers: [MouvementsService, StockCalculatorService],
  exports: [MouvementsService],
})
export class MouvementsModule {}
