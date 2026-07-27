import { Module } from '@nestjs/common';
import { FileUploadsService } from './file-uploads.service';
import { FileUploadsController } from './file-uploads.controller';

@Module({
  controllers: [FileUploadsController],
  providers: [FileUploadsService],
  exports: [FileUploadsService],
})
export class FileUploadsModule {}
