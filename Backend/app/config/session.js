const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const { getMongoUri } = require('./mongoUri');

dotenv.config();

const usePersistentStore =
  process.env.NODE_ENV === 'production' && process.env.SESSION_STORE !== 'memory';

const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV !== 'production'
    ? 'kayod-local-admin-session-secret'
    : null);

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required in production');
}

const configuredSameSite = process.env.SESSION_COOKIE_SAME_SITE?.toLowerCase();
const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite)
  ? configuredSameSite
  : process.env.NODE_ENV === 'production'
    ? 'none'
    : 'lax';

const sessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite
  },
  name: 'admin.session.id'
};

// Local and E2E runs use express-session's in-memory store so authentication
// does not depend on a second MongoDB connection from connect-mongo. Production
// keeps persistent sessions unless SESSION_STORE=memory is explicitly set.
if (usePersistentStore) {
  sessionOptions.store = MongoStore.create({
    mongoUrl: getMongoUri(),
    touchAfter: 24 * 3600, // lazy session update
    ttl: 24 * 60 * 60 // 24 hours
  });
}

const sessionConfig = session(sessionOptions);

module.exports = { sessionConfig };