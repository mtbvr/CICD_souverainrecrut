/**
 * Vérifie le chargement de la configuration selon l'environnement.
 * Chaque test recharge les modules avec un process.env isolé.
 */
describe("config/env", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.dontMock("dotenv");
  });

  const loadEnv = (vars: NodeJS.ProcessEnv) => {
    process.env = { ...vars };
    // Empêche dotenv de lire un éventuel fichier .env local
    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    let env!: typeof import("../../src/config/env").env;
    jest.isolateModules(() => {
      env = require("../../src/config/env").env;
    });
    return env;
  };

  it("applique les valeurs par défaut en l'absence de variables", () => {
    const env = loadEnv({});

    expect(env).toEqual({
      port: 4500,
      nodeEnv: "development",
      databaseUrl: "",
      jwtSecret: "",
      apiVersion: "v1",
      frontendUrl: "http://localhost:5173",
    });
  });

  it("lit les variables d'environnement fournies", () => {
    const env = loadEnv({
      PORT: "4000",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db",
      JWT_SECRET: "secret",
      API_VERSION: "v2",
      FRONTEND_URL: "https://app.example.com",
    });

    expect(env).toEqual({
      port: 4000,
      nodeEnv: "production",
      databaseUrl: "postgresql://db",
      jwtSecret: "secret",
      apiVersion: "v2",
      frontendUrl: "https://app.example.com",
    });
  });
});

describe("middlewares/logger", () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock("morgan");
    jest.dontMock("../../src/config/env");
  });

  const loadLogger = (nodeEnv: string) => {
    const morgan = jest.fn((..._args: unknown[]) => "middleware");
    jest.doMock("morgan", () => morgan);
    jest.doMock("../../src/config/env", () => ({ env: { nodeEnv } }));

    jest.isolateModules(() => {
      require("../../src/middlewares/logger.middleware");
    });
    return morgan;
  };

  it("utilise le format 'combined' en production", () => {
    expect(loadLogger("production")).toHaveBeenCalledWith("combined");
  });

  it("utilise le format 'dev' hors production, désactivé en test", () => {
    const morgan = loadLogger("test");

    expect(morgan).toHaveBeenCalledWith("dev", expect.any(Object));

    const options = morgan.mock.calls[0][1] as { skip: () => boolean };
    expect(options.skip()).toBe(true);
  });
});
