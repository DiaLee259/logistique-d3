import { Module } from '@nestjs/common';
import { InventairesController } from './inventaires.controller';
import { InventairesService } from './inventaires.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventairesController],
  providers: [InventairesService],
})
export class InventairesModule {}
