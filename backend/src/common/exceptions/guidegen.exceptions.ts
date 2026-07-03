import { HttpException, HttpStatus } from '@nestjs/common';

export class BrowserException extends HttpException {
  constructor(message: string) {
    super(`Browser error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class LoginException extends HttpException {
  constructor(message: string) {
    super(`Login failed: ${message}`, HttpStatus.UNAUTHORIZED);
  }
}

export class CrawlException extends HttpException {
  constructor(message: string) {
    super(`Crawl error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class AiException extends HttpException {
  constructor(message: string) {
    super(`AI error: ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class ProjectNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Project not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}

export class ExportException extends HttpException {
  constructor(message: string) {
    super(`Export failed: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
