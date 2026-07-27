import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as xss from 'xss';

@Injectable()
export class XssSanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (value === null || value === undefined) return value;
    const type = metadata.metatype;
    if (!type || [String, Number, Boolean, Object].includes(type as any)) {
      return this.sanitize(value);
    }
    return this.sanitize(value);
  }

  private sanitize(value: any): any {
    if (typeof value === 'string') {
      return xss.filterXSS(value, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style', 'iframe'],
        onTag: (_tag, _html, _options) => '',
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        sanitized[key] = this.sanitize(value[key]);
      }
      return sanitized;
    }

    return value;
  }
}
