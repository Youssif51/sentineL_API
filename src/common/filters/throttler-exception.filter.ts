import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
//import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter { 
  catch(exception: any, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
  
    const status = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      typeof exception?.getResponse === 'function' ? exception.getResponse() : null;

    let message = exception.message || 'Internal server error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseMessage = (exceptionResponse as { message?: string | string[] }).message;

      if (Array.isArray(responseMessage) && responseMessage.length > 0) {
        message = responseMessage[0];
      } else if (typeof responseMessage === 'string' && responseMessage) {
        message = responseMessage;
      }
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'to many req wait';
      response.setHeader('Retry-After', '60');
    }
    // for me 
    console.error('--- EXCEPTION CAUGHT ---');
    console.error(`Status: ${status} | Message: ${message}`);
    if (status === 500) console.error(exception);

    //for user
    response.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(), 
    });
  }
}
