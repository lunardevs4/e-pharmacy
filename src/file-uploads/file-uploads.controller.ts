import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileUploadsService } from './file-uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@generated/prisma';
import { Roles } from '../common/guards/roles.decorator';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

@ApiTags('File Uploads')
@Controller('api/v1/upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileUploadsController {
  constructor(private fileUploadsService: FileUploadsService) {}

  @Post('prescription')
  @Roles(UserRole.PATIENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Endpoint: POST /api/v1/upload/prescription\n\nBody: multipart/form-data with a "file" field containing the prescription document (PDF/JPEG/PNG, max 10MB).',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload prescription document',
    description:
      'Endpoint: POST /api/v1/upload/prescription\n\nUploads a prescription document (PDF/JPEG/PNG) as a multipart/form-data request with a "file" field. Max file size: 10MB.',
  })
  async uploadPrescription(
    @UploadedFile()
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.fileUploadsService.validateFile(
      file,
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      10 * 1024 * 1024,
    );
    const uploadDirectory = join(
      process.cwd(),
      'uploads',
      'prescriptions',
    );
    await fs.mkdir(uploadDirectory, { recursive: true });
    const extension = extname(file.originalname).toLowerCase();
    const randomName = `${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`;
    const fullPath = join(uploadDirectory, randomName);
    await fs.writeFile(fullPath, file.buffer);
    return { fileUrl: `/uploads/prescriptions/${randomName}` };
  }

  @Post('license')
  @Roles(UserRole.PHARMACY_OWNER)
  @ApiOperation({
    summary: 'Upload pharmacy license',
    description:
      'Endpoint: POST /api/v1/upload/license\n\nUploads a pharmacy license document (PDF/JPEG/PNG) as a multipart/form-data request with a "file" field. Max file size: 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    description:
      'Body: multipart/form-data with a "file" field containing the pharmacy license (PDF/JPEG/PNG, max 10MB).',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadLicense(
    @UploadedFile()
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.fileUploadsService.validateFile(
      file,
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      10 * 1024 * 1024,
    );
    const randomName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
    const uploadDirectory = join(
      process.cwd(),
      'uploads',
      'licenses',
    );
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(join(uploadDirectory, randomName), file.buffer);
    return { fileUrl: `/uploads/licenses/${randomName}` };
  }
}
