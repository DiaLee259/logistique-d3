import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';
import { PdfService } from '../../pdf/pdf.service';
import { StockCalculatorService } from '../../stock/stock-calculator.service';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [CommandesController],
  providers: [CommandesService, PdfService, StockCalculatorService],
  exports: [CommandesService],
})
export class CommandesModule {}
