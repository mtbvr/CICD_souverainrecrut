import request from "supertest";
import { ApplicationStatus } from "@prisma/client";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { adminToken, recruiterToken } from "../helpers/auth";
import { buildApplication } from "../helpers/fixtures";

describe("API – candidatures (/v1/applications)", () => {
  const application = buildApplication();

  describe("GET /", () => {
    it("retourne les candidatures avec candidat et offre", async () => {
      prismaMock.application.findMany.mockResolvedValue([application]);
      prismaMock.application.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/v1/applications")
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(prismaMock.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { candidate: true, job: true },
        })
      );
    });
  });

  describe("GET /:id", () => {
    it("retourne la candidature demandée", async () => {
      prismaMock.application.findUnique.mockResolvedValue(application);

      const res = await request(app)
        .get(`/v1/applications/${application.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.PENDING);
    });

    it("renvoie 404 pour une candidature inexistante", async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/applications/inconnue")
        .set("Authorization", adminToken());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Candidature introuvable.");
    });
  });

  describe("POST /", () => {
    it("crée une candidature", async () => {
      prismaMock.application.create.mockResolvedValue(application);

      const res = await request(app)
        .post("/v1/applications")
        .set("Authorization", recruiterToken())
        .send({ candidateId: "candidate-1", jobId: "job-1" });

      expect(res.status).toBe(201);
      expect(prismaMock.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { candidateId: "candidate-1", jobId: "job-1" },
        })
      );
    });

    it("renvoie 400 pour un statut inconnu", async () => {
      const res = await request(app)
        .post("/v1/applications")
        .set("Authorization", recruiterToken())
        .send({ candidateId: "c", jobId: "j", status: "HIRED" });

      expect(res.status).toBe(400);
      expect(prismaMock.application.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT /:id", () => {
    it("met à jour le statut d'une candidature", async () => {
      prismaMock.application.findUnique.mockResolvedValue(application);
      prismaMock.application.update.mockResolvedValue({
        ...application,
        status: ApplicationStatus.ACCEPTED,
      });

      const res = await request(app)
        .put(`/v1/applications/${application.id}`)
        .set("Authorization", recruiterToken())
        .send({ status: ApplicationStatus.ACCEPTED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.ACCEPTED);
    });

    it("renvoie 400 si le statut est absent", async () => {
      const res = await request(app)
        .put(`/v1/applications/${application.id}`)
        .set("Authorization", recruiterToken())
        .send({});

      expect(res.status).toBe(400);
    });

    it("renvoie 404 si la candidature n'existe pas", async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/v1/applications/inconnue")
        .set("Authorization", recruiterToken())
        .send({ status: ApplicationStatus.REJECTED });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("permet à un ADMIN de supprimer une candidature", async () => {
      prismaMock.application.findUnique.mockResolvedValue(application);
      prismaMock.application.delete.mockResolvedValue(application);

      const res = await request(app)
        .delete(`/v1/applications/${application.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
    });

    it("refuse (403) la suppression à un RECRUITER", async () => {
      const res = await request(app)
        .delete(`/v1/applications/${application.id}`)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(403);
    });
  });
});
