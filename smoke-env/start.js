#!/usr/bin/env node
/**
 * Demo copy of the KayodManage admin portal, for manual smoke testing.
 *
 * Starts three things on this machine, none of which touch the live database
 * or your usual servers (backend :5000, frontend :5173):
 *   - a throwaway MongoDB replica set on 127.0.0.1:27037 (data in smoke-env/.data)
 *   - the admin backend on :5050, pointed at that database
 *   - the admin frontend on http://localhost:5180
 *
 *   node smoke-env/start.js           start (loads the demo data the first time)
 *   node smoke-env/start.js --reset   start again from a fresh copy of the demo data
 *   add --fault-injection             let smoke-env/inject-fault.js make the backend's
 *                                     next write fail (to check rollback); test only
 *
 * Sign in as smoke.admin / smoke-test-only. Ctrl+C stops everything.
 * MongoDB 8 is expected at the default Windows path; set MONGOD_PATH otherwise.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const BE = path.join(ROOT, 'Backend');
const FE = path.join(ROOT, 'Frontend');
const DATA = path.join(__dirname, '.data');
const RS_DATA = path.join(DATA, 'rsdata');
const LOGS = path.join(DATA, 'logs');
const DB = 'smoke_kayod';
const REPL_SET = 'rssmoke';
const PORT = { mongo: 27037, api: 5050, web: 5180 };
const MONGOD = process.env.MONGOD_PATH || 'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe';
const WEB_URL = `http://localhost:${PORT.web}`;
const API_URL = `http://localhost:${PORT.api}`;
const reset = process.argv.includes('--reset');
const faultInjection = process.argv.includes('--fault-injection');
// Names the backend's database connections, so check-consistency.js and
// inject-fault.js can tell its writes apart from their own.
const BACKEND_APP_NAME = 'kayod-admin-demo';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Labelled stand-in pictures for the demo data's photos (/demo-images/<tag>.svg),
 * so a face check, an ID or a job photo shows what it is instead of a broken
 * image. The tag says what it is: face-3-left, id-3-back, cert-3, job-0-a, evidence-c.
 */
const DEMO_IMAGE_LABELS = { face: 'Face photo', id: 'Valid ID', cert: 'Certificate', job: 'Job photo', evidence: 'Dispute evidence' };
function demoImageSvg(tag) {
  const [kind, , side] = tag.split('-');
  const title = DEMO_IMAGE_LABELS[kind] || 'Photo';
  const sub = { left: 'left side', front: 'front', right: 'right side', back: 'back' }[side] || '';
  const esc = (s) => s.replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
<rect width="480" height="320" fill="#EEF2F7"/><rect x="24" y="24" width="432" height="272" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
<text x="240" y="150" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#334155" text-anchor="middle">${esc(title)}</text>
<text x="240" y="190" font-family="Arial, sans-serif" font-size="20" fill="#64748B" text-anchor="middle">${esc(sub)}</text>
<text x="240" y="262" font-family="Arial, sans-serif" font-size="14" letter-spacing="3" fill="#94A3B8" text-anchor="middle">DEMO IMAGE · ${esc(tag)}</text></svg>`;
}
const demoImages = {
  name: 'kayod-demo-images',
  configureServer(server) {
    server.middlewares.use('/demo-images', (req, res) => {
      const tag = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '').replace(/\.\w+$/, '');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(demoImageSvg(tag || 'photo'));
    });
  },
};
// A few places in the frontend hardcode http://localhost:5000 (your usual
// backend) instead of reading VITE_API_URL: the live-update socket and the
// Dashboard's alerts "Reset" button. In the demo they would reach your real
// backend, so they are pointed at the demo one as the files are served. The
// source files are not changed.
const demoBackendUrls = {
  name: 'kayod-demo-backend-urls',
  enforce: 'pre',
  transform(code, id) {
    const file = id.split('?')[0];
    if (!/[\\/]Frontend[\\/]src[\\/].*\.[jt]sx?$/.test(file) || !code.includes('http://localhost:5000')) return null;
    return { code: code.split('http://localhost:5000').join(API_URL), map: null };
  },
};
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

/** Something already accepts connections on this port (IPv4 or IPv6 loopback). */
const listening = (port) => Promise.all(['127.0.0.1', '::1'].map((host) => new Promise((resolve) => {
  const socket = net.connect({ port, host });
  socket.setTimeout(800);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(false));
}))).then((results) => results.some(Boolean));

const children = [];
let vite = null;
let stopping = false;

async function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping the demo environment…');
  try { await vite?.close(); } catch { /* already gone */ }
  for (const child of children.reverse()) {
    if (child.exitCode === null) child.kill();
  }
  await sleep(500);
  process.exit(code);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

function startChild(name, command, args, options = {}) {
  const log = fs.openSync(path.join(LOGS, `${name}.log`), 'a');
  // The backend's own log lines carry no time, so mark where this run starts:
  // check-consistency.js reads only what follows the last marker.
  fs.writeSync(log, `\n=== ${name} started ${new Date().toISOString()} ===\n`);
  const child = spawn(command, args, { stdio: ['ignore', log, log], windowsHide: true, ...options });
  children.push(child);
  child.once('exit', (code) => {
    // Ctrl+C reaches every process on this console at once, so a child can
    // exit a moment before our own SIGINT handler runs: wait before calling
    // it unexpected.
    setTimeout(() => {
      if (stopping) return;
      console.error(`\n✖ ${name} stopped unexpectedly (exit ${code}). Its log: ${path.join(LOGS, `${name}.log`)}`);
      stopAll(1);
    }, 500);
  });
  return child;
}

async function main() {
  console.log('KayodManage demo environment\n');

  // ── Pre-flight ─────────────────────────────────────────────────────────
  if (!fs.existsSync(MONGOD)) fail(`mongod not found at ${MONGOD}. Install MongoDB 8 or set MONGOD_PATH.`);
  for (const dir of [path.join(BE, 'node_modules'), path.join(FE, 'node_modules')]) {
    if (!fs.existsSync(dir)) fail(`${dir} is missing — run npm install in ${path.dirname(dir)} first.`);
  }
  for (const [name, port] of Object.entries(PORT)) {
    if (await listening(port)) fail(`Port ${port} (${name}) is already in use — is the demo already running? Stop it first.`);
  }
  if (await listening(5000)) {
    console.log('ℹ Your usual backend is running on :5000. That is fine — the demo does not use it.');
    console.log('  Use a private/incognito window for the demo so the two logins do not overwrite each other.\n');
  }

  if (reset && fs.existsSync(RS_DATA)) {
    console.log('Resetting: deleting the previous demo database…');
    try {
      // Windows keeps a stopped mongod's files locked for a moment; retry
      // rather than fail on the first ENOTEMPTY/EBUSY.
      fs.rmSync(RS_DATA, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch (e) {
      fail(`Could not delete the old demo database (${e.code}). A MongoDB from a previous run may still be closing — wait a few seconds and run the command again.`);
    }
  }
  fs.mkdirSync(RS_DATA, { recursive: true });
  fs.mkdirSync(LOGS, { recursive: true });

  // ── Database ───────────────────────────────────────────────────────────
  process.stdout.write('Starting MongoDB on 127.0.0.1:27037… ');
  startChild('mongod', MONGOD, [
    '--replSet', REPL_SET, '--port', String(PORT.mongo), '--bind_ip', '127.0.0.1', '--dbpath', RS_DATA,
    // MongoDB's failCommand fail point, which inject-fault.js arms. Only on request.
    ...(faultInjection ? ['--setParameter', 'enableTestCommands=1'] : []),
  ]);
  const { MongoClient } = require(path.join(BE, 'node_modules/mongodb'));
  let client;
  for (let i = 0; i < 60 && !client; i++) {
    try {
      client = await new MongoClient(`mongodb://127.0.0.1:${PORT.mongo}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 }).connect();
    } catch { await sleep(1000); }
  }
  if (!client) fail('MongoDB did not start. See smoke-env/.data/logs/mongod.log');
  try {
    await client.db('admin').command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${PORT.mongo}` }] } });
  } catch (e) {
    if (e.codeName !== 'AlreadyInitialized') throw e;
  }
  for (let i = 0; i < 60; i++) {
    if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) break;
    await sleep(500);
  }
  const hasData = (await client.db(DB).collection('users').estimatedDocumentCount()) > 0;
  await client.close();
  console.log('ready');

  if (!hasData) {
    console.log('Loading the demo data…');
    const seeded = spawnSync(process.execPath, [path.join(__dirname, 'seed.js'), DB], { stdio: 'inherit' });
    if (seeded.status !== 0) fail('Loading the demo data failed (see the error above).');
  }

  // ── Backend ────────────────────────────────────────────────────────────
  // Every variable Backend/.env defines is set here, because dotenv only
  // fills in what is missing: anything left unset would come from the real
  // .env — the live database, the live ImageKit/Cloudinary keys, the Kayod
  // server. The dead KAYOD_BACKEND_URL keeps push notifications off it.
  process.stdout.write(`Starting the admin backend on :${PORT.api}… `);
  startChild('backend', process.execPath, ['server.js'], {
    cwd: BE,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT.api),
      HOST: '127.0.0.1',
      SOCKET_PORT: String(PORT.api + 1),
      MONGODB_URI: `mongodb://127.0.0.1:${PORT.mongo}/${DB}?replicaSet=${REPL_SET}&appName=${BACKEND_APP_NAME}`,
      SESSION_STORE: 'memory',
      SESSION_SECRET: 'kayod-demo-environment-only',
      ADMIN_USERNAME: 'none',
      ADMIN_PASSWORD: 'none',
      ADMIN_FRONTEND_ORIGINS: WEB_URL,
      KAYOD_BACKEND_URL: 'http://127.0.0.1:9',
      KAYOD_API_KEY: 'demo',
      IMAGEKIT_PUBLIC_KEY: 'public_demo',
      IMAGEKIT_PRIVATE_KEY: 'private_demo',
      IMAGEKIT_URL_ENDPOINT: 'https://ik.demo.invalid/demo',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'demo',
      CLOUDINARY_API_SECRET: 'demo',
    },
  });
  let apiUp = false;
  for (let i = 0; i < 60 && !apiUp; i++) {
    try { await fetch(`${API_URL}/api/jobs`); apiUp = true; } catch { await sleep(1000); }
  }
  if (!apiUp) fail('The backend did not start. See smoke-env/.data/logs/backend.log');
  console.log('ready');

  // ── Frontend ───────────────────────────────────────────────────────────
  // Frontend/vite.config.ts proxies /api to :5000 (your usual backend), so
  // the dev server is started here with the proxy pointed at the demo one.
  process.stdout.write(`Starting the admin frontend on :${PORT.web}… `);
  process.env.VITE_API_URL = API_URL;
  process.env.VITE_API_BASE_URL = `${API_URL}/api`;
  process.env.VITE_SOCKET_URL = API_URL;
  process.env.VITE_CJS_IGNORE_WARNING = 'true';
  // Tailwind finds tailwind.config.js (and its `content` globs) from the
  // working directory, not Vite's root: run from anywhere else, every style
  // is missing.
  process.chdir(FE);
  const { createServer } = await import(pathToFileURL(path.join(FE, 'node_modules/vite/dist/node/index.js')).href);
  const reactPlugin = require(require.resolve('@vitejs/plugin-react', { paths: [FE] }));
  const react = reactPlugin.default || reactPlugin;
  vite = await createServer({
    configFile: false,
    root: FE,
    cacheDir: path.join(DATA, 'vite-cache'),
    logLevel: 'error',
    plugins: [demoBackendUrls, react(), demoImages],
    server: {
      host: 'localhost',
      port: PORT.web,
      strictPort: true,
      proxy: { '/api': { target: API_URL, changeOrigin: true } },
    },
  });
  await vite.listen();
  console.log('ready');

  console.log(`
────────────────────────────────────────────────────────────
  Demo admin portal:  ${WEB_URL}
  Sign in:            smoke.admin  /  smoke-test-only
  Open it in a private/incognito window.
  Ctrl+C stops everything. Start again with --reset for fresh demo data.${faultInjection ? '\n  Fault injection is ON: node smoke-env/inject-fault.js --help' : ''}
────────────────────────────────────────────────────────────`);
}

main().catch((e) => { console.error(e); stopAll(1); });
