const { randomUUID } = require('crypto');
const { runWithRequestId } = require('../utils/requestContext');

const ACCEPTED_INBOUND_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

const requestId = (req, res, next) => {
  const inbound = req.get('x-request-id');
  const id = inbound && ACCEPTED_INBOUND_REQUEST_ID.test(inbound) ? inbound : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  runWithRequestId(id, next);
};

module.exports = { requestId };
