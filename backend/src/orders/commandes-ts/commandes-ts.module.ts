import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CommandesTSController } from './commandes-ts.controller';
import { CommandesTSService } from './commandes-ts.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [CommandesTSController],
  providers: [CommandesTSService],
})
export class CommandesTSModule {}
