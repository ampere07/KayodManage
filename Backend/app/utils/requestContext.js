const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const requestContext = new AsyncLocalStorage();

const runWithRequestId = (requestId, fn) => requestContext.run({ requestId }, fn);

const runWithNewRequestId = (fn) => runWithRequestId(randomUUID(), fn);

const getRequestId = () => requestContext.getStore()?.requestId;

module.exports = { runWithRequestId, runWithNewRequestId, getRequestId };
