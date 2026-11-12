import request from "supertest";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { adminToken, recruiterToken } from "../helpers/auth";
import { buildJob } from "../helpers/fixtures";

describe("API – offres d'emploi (/v1/jobs)", () => {
  const job = buildJob();

  const payload = {
    title: "Développeur Backend",
    description: "Développement d'API REST Node.js",
    location: "Rennes",
    company: "SouverainRecrut",
    recruiterId: "user-1",
  };

  describe("GET /", () => {
    it("retourne la liste paginée des offres (limite par défaut)", async () => {
      prismaMock.job.findMany.mockResolvedValue([job]);
      prismaMock.job.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/v1/jobs")
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe(job.title);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
    });
  });

  describe("GET /:id", () => {
    it("retourne l'offre demandée", async () => {
      prismaMock.job.findUnique.mockResolvedValue(job);

      const res = await request(app)
        .get(`/v1/jobs/${job.id}`)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(job.id);
    });

    it("renvoie 404 pour une offre inexistante", async () => {
      prismaMock.job.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/jobs/inconnue")
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Offre introuvable.");
    });
  });

  describe("POST /", () => {
    it("crée une offre", async () => {
      prismaMock.job.create.mockResolvedValue(job);

      const res = await request(app)
        .post("/v1/jobs")
        .set("Authorization", recruiterToken())
        .send(payload);

      expect(res.status).toBe(201);
      expect(prismaMock.job.create).toHaveBeenCalledWith({ data: payload });
    });

    it("renvoie 400 si des champs obligatoires manquent", async () => {
      const res = await request(app)
        .post("/v1/jobs")
        .set("Authorization", recruiterToken())
        .send({ title: "Dev" });

      expect(res.status).toBe(400);
      expect(prismaMock.job.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT /:id", () => {
    it("met à jour une offre existante", async () => {
      prismaMock.job.findUnique.mockResolvedValue(job);
      prismaMock.job.update.mockResolvedValue({ ...job, location: "Paris" });

      const res = await request(app)
        .put(`/v1/jobs/${job.id}`)
        .set("Authorization", recruiterToken())
        .send({ location: "Paris" });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe("Paris");
    });

    it("renvoie 404 si l'offre n'existe pas", async () => {
      prismaMock.job.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/v1/jobs/inconnue")
        .set("Authorization", recruiterToken())
        .send({ location: "Paris" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("permet à un ADMIN de supprimer une offre", async () => {
      prismaMock.job.findUnique.mockResolvedValue(job);
      prismaMock.job.delete.mockResolvedValue(job);

      const res = await request(app)
        .delete(`/v1/jobs/${job.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
    });

    it("refuse (403) la suppression à un RECRUITER", async () => {
      const res = await request(app)
        .delete(`/v1/jobs/${job.id}`)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(403);
    });

    it("renvoie 404 si l'offre n'existe pas", async () => {
      prismaMock.job.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete("/v1/jobs/inconnue")
        .set("Authorization", adminToken());

      expect(res.status).toBe(404);
      expect(prismaMock.job.delete).not.toHaveBeenCalled();
    });
  });
});
