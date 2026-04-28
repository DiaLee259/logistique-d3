import { Injectable } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class UploadsService {
  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  getFilePath(filename: string): string {
    return join(process.env.UPLOAD_DIR || './uploads', filename);
  }
}
