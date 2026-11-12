/**
 * Variables d'environnement de test.
 * Chargées avant tout import de l'application (dotenv ne les écrase pas).
 */
process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_QUIET = "true";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.API_VERSION = "v1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
