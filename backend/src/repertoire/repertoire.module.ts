import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { RepertoireController } from './repertoire.controller';
import { RepertoireService } from './repertoire.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [RepertoireController],
  providers: [RepertoireService],
  exports: [RepertoireService],
})
export class RepertoireModule {}
