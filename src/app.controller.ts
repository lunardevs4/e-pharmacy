import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/guards/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello() {
    return {
      message: 'Welcome to the Rwanda E-Pharmacy API',
      version: '1.0.0',
      docs: '/api/docs',
    };
  }
}
