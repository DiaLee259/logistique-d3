import { Module } from '@nestjs/common';
import { EntrepotsController } from './entrepots.controller';
import { EntrepotsService } from './entrepots.service';

@Module({
  controllers: [EntrepotsController],
  providers: [EntrepotsService],
  exports: [EntrepotsService],
})
export class EntrepotsModule {}
