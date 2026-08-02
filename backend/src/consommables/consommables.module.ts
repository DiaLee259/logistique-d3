import { Module } from '@nestjs/common';
import { ConsommablesController } from './consommables.controller';
import { ConsommablesService } from './consommables.service';
import { ConsommablesImportService } from './consommables-import.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConsommablesController],
  providers: [ConsommablesService, ConsommablesImportService],
})
export class ConsommablesModule {}
