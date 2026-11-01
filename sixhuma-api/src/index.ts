import { server } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server gracefully");
  server.close(() => {
    logger.info("HTTP and WebSocket server closed cleanly");
    process.exit(0);
  });

  // Force exit after 1.5s if keepalive connections linger
  setTimeout(() => {
    process.exit(0);
  }, 1500).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
