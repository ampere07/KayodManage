const crypto = require('node:crypto');

const DEVELOPMENT_SUPPORT_SERVICE_KEY = 'kayod-local-support-key';

const getExpectedServiceKey = () =>
  process.env.SUPPORT_SERVICE_KEY ||
  process.env.KAYOD_API_KEY ||
  (process.env.NODE_ENV !== 'production'
    ? DEVELOPMENT_SUPPORT_SERVICE_KEY
    : null);

const safeEqual = (provided, expected) => {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const supportServiceAuth = (req, res, next) => {
  const expectedKey = getExpectedServiceKey();
  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      error: 'Support service authentication is not configured'
    });
  }

  const providedKey = req.get('x-api-key');
  if (!safeEqual(providedKey, expectedKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid support service credentials'
    });
  }

  return next();
};

module.exports = {
  DEVELOPMENT_SUPPORT_SERVICE_KEY,
  getExpectedServiceKey,
  supportServiceAuth
};
