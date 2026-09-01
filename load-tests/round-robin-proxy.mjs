// Minimal, dependency-free round-robin reverse proxy — for locally testing
// whether running multiple standalone server instances (using this
// machine's other idle CPU cores) actually fixes the single-process
// bottleneck, before touching anything about how production is deployed.
import http from "node:http";

const backends = (process.env.BACKENDS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (backends.length === 0) {
  console.error("Set BACKENDS=host:port,host:port,...");
  process.exit(1);
}
let i = 0;

const server = http.createServer((req, res) => {
  const target = backends[i % backends.length];
  i++;
  const [host, port] = target.split(":");
  const proxyReq = http.request(
    { host, port, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    res.writeHead(502);
    res.end("bad gateway");
  });
  req.pipe(proxyReq);
});

const port = process.env.PORT || 4200;
server.listen(port, () => console.log(`round-robin proxy on :${port} -> ${backends.join(", ")}`));
