import app from "./app";
import { logger } from "./lib/logger";

export default app;

if (process.env.NODE_ENV !== "production") {
  const port = Number(process.env["PORT"] ?? 3001);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}
