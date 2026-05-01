import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { StockCalculatorService } from '../stock/stock-calculator.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, StockCalculatorService],
})
export class AdminModule {}
