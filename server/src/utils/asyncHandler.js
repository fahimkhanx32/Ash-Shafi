/**
 * Wraps an async Express route/middleware handler so any rejected
 * promise is forwarded to Express's centralized error handler
 * (`errorMiddleware`) instead of crashing the process or requiring
 * a manual try/catch in every controller.
 *
 * Usage:
 *   router.post('/login', asyncHandler(loginController));
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
