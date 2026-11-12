import request from "supertest";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";

describe("API – routes générales", () => {
  it("GET / retourne le message d'accueil", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      api: "/v1",
      documentation: "/api-docs",
    });
  });

  it("ne révèle pas le framework via l'en-tête X-Powered-By", async () => {
    const res = await request(app).get("/");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /api-docs/ sert la documentation Swagger", async () => {
    const res = await request(app).get("/api-docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger");
  });

  it("GET /v1/info retourne les informations de l'API", async () => {
    const res = await request(app).get("/v1/info");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "SouverainRecrut API",
      apiVersion: "v1",
      health: "/v1/health",
      readiness: "/v1/ready",
    });
  });

  it("retourne 404 pour une route inconnue", async () => {
    const res = await request(app).get("/v1/inexistante");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Route /v1/inexistante introuvable.");
  });
});

describe("API – health checks", () => {
  it("GET /v1/health indique que l'API est UP", async () => {
    const res = await request(app).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("UP");
    expect(typeof res.body.data.uptime).toBe("number");
  });

  it("GET /v1/ready renvoie 200 quand la base répond", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/v1/ready");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "READY",
      database: "CONNECTED",
    });
  });

  it("GET /v1/ready renvoie 503 quand la base est indisponible", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connexion refusée"));

    const res = await request(app).get("/v1/ready");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.database).toBe("DISCONNECTED");
  });
});
