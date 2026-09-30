const { STATUS_CODES } = require('http');
const { logger } = require('../utils/logger');
const { pathWithoutQuery } = require('./accessLog');

const responseStatusFor = (err) => {
  const status = err.status || err.statusCode;
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
};

const errorHandler = (err, req, res, next) => {
  const status = responseStatusFor(err);
  const level = status >= 500 ? 'error' : 'warn';
  logger.log(level, 'Request failed', { err, method: req.method, path: pathWithoutQuery(req), status });
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(status).type('text/plain').send(STATUS_CODES[status]);
};

module.exports = { errorHandler };
