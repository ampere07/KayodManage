let ioInstance = null;

const setIO = (instance) => {
  ioInstance = instance;
};

const getIO = () => ioInstance;

module.exports = { setIO, getIO };
