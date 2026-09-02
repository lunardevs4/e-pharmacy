import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/guards/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  getHello() {
    return {
      success: true,
      message: 'Welcome to the Rwanda E-Pharmacy API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      docs: '/api/docs'
    };
  }
}
