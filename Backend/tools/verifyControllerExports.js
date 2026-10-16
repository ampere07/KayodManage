#!/usr/bin/env node
/**
 * Structural check on the controller/route layer.
 *
 * A refactor that rewrites control flow across every controller can stay
 * syntactically valid while quietly losing a handler — two functions merged
 * into one still parses. What does not survive that is the wiring: a route
 * would bind `undefined`, and Express only complains at request time, in
 * production. So this loads every controller and every route module and asserts
 * that each exported handler is still a callable function.
 *
 *   node tools/verifyControllerExports.js
 */

const fs = require('node:fs');
const path = require('node:path');

const CONTROLLERS = path.join(__dirname, '..', 'app', 'controllers');
const ROUTES = path.join(__dirname, '..', 'app', 'routes');

let failures = 0;
let handlers = 0;

const listJs = (dir) =>
  fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .sort();

console.log('=== controllers ===');
for (const file of listJs(CONTROLLERS)) {
  const full = path.join(CONTROLLERS, file);
  let exported;
  try {
    exported = require(full);
  } catch (error) {
    console.log(`  FAIL  ${file}: does not load — ${error.message}`);
    failures += 1;
    continue;
  }

  const names = Object.keys(exported || {});
  const bad = names.filter((name) => typeof exported[name] !== 'function');
  handlers += names.length - bad.length;

  if (bad.length > 0) {
    console.log(`  FAIL  ${file}: not a function -> ${bad.join(', ')}`);
    failures += 1;
  } else {
    console.log(`  ok    ${file} (${names.length} exports)`);
  }
}

console.log('\n=== routes ===');
for (const file of listJs(ROUTES)) {
  const full = path.join(ROUTES, file);
  try {
    const router = require(full);
    // An Express router that bound `undefined` throws at require time, so
    // reaching here already proves every handler it references resolved.
    const routeCount = router?.stack?.filter((layer) => layer.route).length ?? 0;
    console.log(`  ok    ${file} (${routeCount} routes)`);
  } catch (error) {
    console.log(`  FAIL  ${file}: ${error.message}`);
    failures += 1;
  }
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${handlers} exported handlers, ${failures} problem(s)`);
process.exitCode = failures === 0 ? 0 : 1;
