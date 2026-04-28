import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { ExcelParserService } from './excel-parser.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
    private excelParser: ExcelParserService,
  ) {}

  @Post('fichier')
  @UseInterceptors(FileInterceptor('file'))
  uploadFichier(@UploadedFile() file: Express.Multer.File) {
    return {
      url: this.uploadsService.getFileUrl(file.filename),
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
    };
  }

  @Post('excel/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseExcel(@UploadedFile() file: Express.Multer.File) {
    const result = await this.excelParser.parseCommandeExcel(file.path);
    return {
      ...result,
      fichierUrl: this.uploadsService.getFileUrl(file.filename),
      filename: file.filename,
    };
  }
}
