import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

// Game generation runs as a sequence of up to 5-6 chunked Claude calls
// (each up to 65s, with up to 3 retries on failure) — worst case can exceed
// 10 minutes, so the socket timeout must comfortably exceed that instead of
// the old single-call ~3 minute assumption.
server.setTimeout(600_000);
server.keepAliveTimeout = 600_000;
server.headersTimeout = 605_000;
