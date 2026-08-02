import { Module } from '@nestjs/common';
import { ConsommablesController } from './consommables.controller';
import { ConsommablesService } from './consommables.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConsommablesController],
  providers: [ConsommablesService],
})
export class ConsommablesModule {}
