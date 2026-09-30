const { createLogger, format, transports } = require('winston');
const { getRequestId } = require('./requestContext');

const isProduction = process.env.NODE_ENV === 'production';

const attachRequestId = format((info) => {
  if (info.requestId === undefined) {
    const requestId = getRequestId();
    if (requestId) info.requestId = requestId;
  }
  return info;
});

const serializeError = (error) => ({
  name: error.name,
  message: error.message,
  ...(error.code !== undefined && { code: error.code }),
  stack: error.stack
});

const serializeErrorFields = format((info) => {
  for (const key of Object.keys(info)) {
    if (info[key] instanceof Error) info[key] = serializeError(info[key]);
  }
  return info;
});

const renderReadableLine = format.printf((info) => {
  const { timestamp, level, message, requestId, stack, ...fields } = info;
  const stacks = stack ? [stack] : [];
  const extra = {};
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    if (value instanceof Error) {
      extra[key] = value.message;
      stacks.push(value.stack);
    } else {
      extra[key] = value;
    }
  }
  const idPart = requestId ? ` [${requestId}]` : '';
  const extraPart = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  const stackPart = stacks.map((trace) => `\n${trace}`).join('');
  return `${timestamp} ${level}${idPart} ${message}${extraPart}${stackPart}`;
});

const productionFormat = format.combine(
  format.errors({ stack: true }),
  attachRequestId(),
  serializeErrorFields(),
  format.timestamp(),
  format.json()
);

const readableFormat = format.combine(
  format.errors({ stack: true }),
  attachRequestId(),
  format.timestamp({ format: 'HH:mm:ss.SSS' }),
  format.colorize(),
  renderReadableLine
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'http' : 'debug'),
  format: isProduction ? productionFormat : readableFormat,
  transports: [new transports.Console()]
});

module.exports = { logger };
