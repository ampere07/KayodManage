const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * The request currently being handled, reachable from code that wasn't handed
 * `req` — the audit logger uses it to record the IP address and browser for
 * every admin action, including the older call sites that only pass an admin id.
 * Outside a request (schedulers, socket handlers) it is undefined.
 */
const storage = new AsyncLocalStorage();

const requestContext = (req, res, next) => storage.run({ req }, next);

const currentRequest = () => storage.getStore()?.req;

module.exports = { requestContext, currentRequest };
