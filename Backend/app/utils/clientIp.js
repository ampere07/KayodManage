/**
 * The caller's IP address, as the Audit Log and the admin session list show it.
 *
 * `req.ip` already reads X-Forwarded-For through the proxies the app trusts
 * (`trust proxy` is set in production), so it is the address our proxy saw.
 * The left-most X-Forwarded-For entry is whatever the client chose to send —
 * reading it directly would let anyone sign in "from" any address they like.
 */
const clientIp = (req) => {
  const ip = req?.ip || req?.socket?.remoteAddress || req?.connection?.remoteAddress;
  return ip ? String(ip).replace(/^::ffff:/, '') : undefined;
};

module.exports = { clientIp };
