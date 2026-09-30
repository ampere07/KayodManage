const { logger } = require('../utils/logger');

const pathWithoutQuery = (req) => req.originalUrl.split('?')[0];

const accessLog = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.http('request completed', {
      requestId: req.id,
      method: req.method,
      path: pathWithoutQuery(req),
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10
    });
  });
  next();
};

module.exports = { accessLog, pathWithoutQuery };
