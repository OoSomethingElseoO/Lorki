// Runs the built standalone server (.next/standalone/server.js, produced by
// `next build` with output: "standalone") across multiple worker processes
// instead of one.
//
// Why this exists: Next.js standalone's own server.js is a single-threaded
// Node process — under concurrent load it saturates exactly one CPU core
// and stalls no matter how many cores the host actually has. Confirmed via
// local load testing (see load-tests/): a single instance failed 26.5% of
// 1680 simulated concurrent sessions (multi-second response times, CPU
// pegged at ~100% of one core while the rest sat idle); running 4 instances
// behind a round-robin proxy dropped that to 0% failures with ~30ms median
// response times, no code changes involved — purely a "use more than one
// process" problem. This makes that fix a permanent, built-in part of the
// app instead of a one-off manual experiment (load-tests/round-robin-proxy.mjs),
// so it applies wherever this actually gets deployed, not just this one
// local test.
//
// Node's cluster module: the primary process here forks N workers, each of
// which re-runs this same file — cluster.isPrimary is false in a forked
// worker, so it falls through to requiring the real server instead of
// forking again. All workers share the one PORT via the OS's own
// connection distribution (handled transparently by cluster.fork()), so
// this is a drop-in replacement for running server.js directly: same PORT
// env var, same behavior from the outside, just spread across more than
// one process.
//
// WEB_CONCURRENCY overrides the worker count — useful on a host where you
// don't want to claim every available vCPU (leaving headroom for other
// processes on the same instance). Defaults to all of them.
const cluster = require("node:cluster");
const os = require("node:os");
const path = require("node:path");

if (cluster.isPrimary) {
  const numWorkers = Number(process.env.WEB_CONCURRENCY) || os.availableParallelism();
  console.log(`[cluster] primary ${process.pid} starting ${numWorkers} worker(s)`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // A worker that crashes takes real traffic capacity down with it — always
  // replace it rather than silently running with fewer workers than intended.
  cluster.on("exit", (worker, code, signal) => {
    console.error(`[cluster] worker ${worker.process.pid} exited (code=${code} signal=${signal}), restarting`);
    cluster.fork();
  });
} else {
  require(path.join(__dirname, ".next", "standalone", "server.js"));
}
