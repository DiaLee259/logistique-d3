import { Module } from '@nestjs/common';
import { RepertoireController } from './repertoire.controller';
import { RepertoireService } from './repertoire.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RepertoireController],
  providers: [RepertoireService],
  exports: [RepertoireService],
})
export class RepertoireModule {}
