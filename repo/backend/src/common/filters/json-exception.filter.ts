import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class JsonExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : "Internal server error";

    response.status(status).json({
      code: status,
      message: typeof payload === "string" ? payload : (payload as Record<string, unknown>).message,
      details: typeof payload === "string" ? null : payload,
      requestId: request.headers["x-request-id"] ?? null,
      timestamp: new Date().toISOString()
    });
  }
}
