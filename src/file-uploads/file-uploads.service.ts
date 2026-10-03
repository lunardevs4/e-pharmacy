import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';

@Injectable()
export class FileUploadsService {
  getStorage(destination: string) {
    const fullPath = join(process.cwd(), 'uploads', destination);

    return diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdir(fullPath, { recursive: true })
          .then(() => cb(null, fullPath))
          .catch((error) => cb(error, fullPath));
      },
      filename: (req, file, cb) => {
        const randomName = randomBytes(16).toString('hex');
        cb(null, `${Date.now()}-${randomName}${extname(file.originalname)}`);
      },
    });
  }

  validateFile(
    file: Express.Multer.File,
    allowedTypes: string[],
    maxSize: number = 5 * 1024 * 1024,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
      );
    }
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Max size: ${maxSize / 1024 / 1024}MB`,
      );
    }
    return true;
  }

  getFileUrl(file: Express.Multer.File, destination: string) {
    return `/uploads/${destination}/${file.filename}`;
  }
}
