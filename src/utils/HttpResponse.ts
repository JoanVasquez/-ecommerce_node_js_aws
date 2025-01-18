export class HttpResponse<T = any> {
  statusCode: number;
  message: string;
  data?: T;
  error?: string;

  constructor(statusCode: number, message: string, data?: T, error?: string) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.error = error;
  }

  static success<T>(
    data: T,
    message = "Success",
    statusCode = 200
  ): HttpResponse<T> {
    return new HttpResponse<T>(statusCode, message, data);
  }

  static error(
    message = "An error occurred",
    statusCode = 500,
    error?: string
  ): HttpResponse {
    return new HttpResponse(statusCode, message, undefined, error);
  }
}
