import morgan from "morgan";
import { env } from "../config/env";

/**
 * Middleware de journalisation HTTP.
 * En développement : format "dev"
 * En production : format "combined"
 * En test : désactivé (logs CI lisibles)
 */
export const loggerMiddleware =
  env.nodeEnv === "production"
    ? morgan("combined")
    : morgan("dev", { skip: () => env.nodeEnv === "test" });