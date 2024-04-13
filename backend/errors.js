class UnauthorizedError extends Error {
    constructor(message) {
      super(message);
      this.name = "UnauthorizedError";
      this.statusCode = 401;
    }
}
  
class InternalServerError extends Error {
    constructor(message) {
      super(message);
      this.name = "InternalServerError";
      this.statusCode = 500;
    }
}

export { UnauthorizedError, InternalServerError };
