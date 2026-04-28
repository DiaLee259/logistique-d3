import { Module } from '@nestjs/common';
import { CommandesTSController } from './commandes-ts.controller';
import { CommandesTSService } from './commandes-ts.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommandesTSController],
  providers: [CommandesTSService],
})
export class CommandesTSModule {}
