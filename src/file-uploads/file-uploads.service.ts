import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class FileUploadsService {
  constructor() {
    const uploadPath = join(process.cwd(), 'uploads');
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
  }

  getStorage(destination: string) {
    const fullPath = join(process.cwd(), 'uploads', destination);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }

    return diskStorage({
      destination: fullPath,
      filename: (req, file, cb) => {
        const randomName = randomBytes(16).toString('hex');
        cb(null, `${Date.now()}-${randomName}${extname(file.originalname)}`);
      },
    });
  }

  validateFile(file: Express.Multer.File, allowedTypes: string[], maxSize: number = 5 * 1024 * 1024) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
    }
    return true;
  }

  getFileUrl(file: Express.Multer.File, destination: string) {
    return `/uploads/${destination}/${file.filename}`;
  }
}
