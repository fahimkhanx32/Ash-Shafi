/**
 * Standardized API response helpers (BET-02).
 *
 * Establishes one consistent response envelope for the whole API,
 * matching the shape already used by the existing auth controllers
 * and `errorMiddleware`:
 *
 *   Success: { success: true, message, data?, meta?, requestId }
 *   Error:   { success: false, error: { code, message, details? }, requestId }
 *
 * These helpers are additive — existing controllers that already
 * build this shape by hand continue to work unchanged. New modules
 * should prefer these helpers to avoid response-shape drift.
 */

export const sendSuccess = (
  res,
  {
    statusCode = 200,
    message = 'Request successful.',
    data = undefined,
    meta = undefined,
    requestId = undefined,
  } = {},
) => {
  const body = {
    success: true,
    message,
  };

  if (data !== undefined) {
    body.data = data;
  }

  if (meta !== undefined) {
    body.meta = meta;
  }

  if (requestId !== undefined) {
    body.requestId = requestId;
  }

  return res.status(statusCode).json(body);
};

export const sendPaginated = (
  res,
  {
    message = 'Request successful.',
    items,
    page,
    limit,
    total,
    requestId = undefined,
  },
) => {
  return sendSuccess(res, {
    statusCode: 200,
    message,
    data: items,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    },
    requestId,
  });
};

export default { sendSuccess, sendPaginated };
