import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { InventairesController } from './inventaires.controller';
import { InventairesService } from './inventaires.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [InventairesController],
  providers: [InventairesService],
})
export class InventairesModule {}
