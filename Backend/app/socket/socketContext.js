const { runWithNewRequestId } = require('../utils/requestContext');
const { logger } = require('../utils/logger');

const socketLogger = (socket) =>
  logger.child({
    socketId: socket.id,
    ...(socket.data?.adminId && { adminId: socket.data.adminId })
  });

const withSocketContext = (connectionHandler) => (socket) =>
  runWithNewRequestId(() => {
    socket.use((packet, next) => runWithNewRequestId(next));
    return connectionHandler(socket);
  });

module.exports = { withSocketContext, socketLogger };
