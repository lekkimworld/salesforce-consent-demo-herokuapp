export class HttpException extends Error {
    statusCode: number;
    message: string;
    error?: Error;
    type: string;

    constructor(
        statusCode: number,
        message: string,
        error?: Error,
        type: string = "json"
    ) {
        super(message);

        this.statusCode = statusCode;
        this.message = message;
        this.error = error;
        this.type = type;
    }
}
