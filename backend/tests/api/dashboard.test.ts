import request from "supertest";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { recruiterToken } from "../helpers/auth";

describe("API – tableau de bord (/v1/dashboard)", () => {
  it("GET /stats agrège les compteurs de la plateforme", async () => {
    prismaMock.user.count.mockResolvedValue(3);
    prismaMock.candidate.count.mockResolvedValue(10);
    prismaMock.job.count.mockResolvedValue(4);
    prismaMock.application.count
      .mockResolvedValueOnce(12) // total
      .mockResolvedValueOnce(5); // PENDING

    const res = await request(app)
      .get("/v1/dashboard/stats")
      .set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      users: 3,
      candidates: 10,
      jobs: 4,
      applications: 12,
      pendingApplications: 5,
    });
  });

  it("refuse (401) l'accès sans authentification", async () => {
    const res = await request(app).get("/v1/dashboard/stats");

    expect(res.status).toBe(401);
  });
});
