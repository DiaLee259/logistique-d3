import { Module } from '@nestjs/common';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';
import { PdfService } from '../../pdf/pdf.service';

@Module({
  controllers: [CommandesController],
  providers: [CommandesService, PdfService],
  exports: [CommandesService],
})
export class CommandesModule {}
