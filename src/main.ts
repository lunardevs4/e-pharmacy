import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import * as hpp from 'hpp';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { XssSanitizationPipe } from './common/pipes/xss-sanitization.pipe';
import { noSqlSanitize } from './common/middleware/nosql-sanitize.middleware';
import { csrfMiddleware } from './common/middleware/csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const frontendOrigin = process.env.FRONTEND_URL?.trim();
  const isHttpsDeployment =
    isProduction || frontendOrigin?.startsWith('https://');
  const connectSources = [
    "'self'",
    ...configuredOrigins,
    ...(frontendOrigin ? [frontendOrigin] : []),
  ];

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Swagger UI uses inline bootstrap code/styles; no unsafe-eval or
          // third-party script/style sources are allowed.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: connectSources,
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          ...(isHttpsDeployment ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      hsts: isHttpsDeployment
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      frameguard: { action: 'deny' },
      xssFilter: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hidePoweredBy: true,
    }),
  );

  app.use((_request, response, next) => {
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    );
    next();
  });

  app.use(csrfMiddleware);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (
        process.env.CORS_ORIGINS ||
        (process.env.NODE_ENV === 'production' ? '' : '*')
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    credentials: true,
    maxAge: 600,
  });

  app.use(hpp());

  app.use(
    noSqlSanitize({
      replaceWith: '_',
      allowDots: false,
    }),
  );

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; style-src 'self'",
      );
    },
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new XssSanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      stopAtFirstError: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Rwanda E-Pharmacy API')
    .setDescription('The national digital health platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      filter: true,
      showRequestDuration: true,
    },
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
