import request from "supertest";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { adminToken, recruiterToken } from "../helpers/auth";
import { buildCandidate } from "../helpers/fixtures";

describe("API – candidats (/v1/candidates)", () => {
  const candidate = buildCandidate();

  describe("GET /", () => {
    it("retourne la liste paginée des candidats", async () => {
      prismaMock.candidate.findMany.mockResolvedValue([candidate]);
      prismaMock.candidate.count.mockResolvedValue(15);

      const res = await request(app)
        .get("/v1/candidates?page=2&limit=5")
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 15,
        totalPages: 3,
      });
      expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 })
      );
    });

    it("refuse (401) l'accès sans authentification", async () => {
      const res = await request(app).get("/v1/candidates");

      expect(res.status).toBe(401);
      expect(prismaMock.candidate.findMany).not.toHaveBeenCalled();
    });
  });

  describe("GET /:id", () => {
    it("retourne le candidat demandé", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(candidate);

      const res = await request(app)
        .get(`/v1/candidates/${candidate.id}`)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(candidate.email);
    });

    it("renvoie 404 pour un candidat inexistant", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/candidates/inconnu")
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Candidat introuvable.");
    });
  });

  describe("POST /", () => {
    const payload = {
      fullName: "Jean Dupont",
      email: "Jean.Dupont@Mail.fr",
      phone: "0612345678",
    };

    it("crée un candidat avec un email normalisé en minuscules", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);
      prismaMock.candidate.create.mockResolvedValue(candidate);

      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send(payload);

      expect(res.status).toBe(201);
      expect(prismaMock.candidate.create).toHaveBeenCalledWith({
        data: { ...payload, email: "jean.dupont@mail.fr" },
      });
    });

    it("renvoie 409 si l'email existe déjà", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(candidate);

      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send(payload);

      expect(res.status).toBe(409);
      expect(prismaMock.candidate.create).not.toHaveBeenCalled();
    });

    it("renvoie 400 pour des données invalides", async () => {
      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send({ fullName: "Jo", email: "pas-un-email" });

      expect(res.status).toBe(400);
      const fields = res.body.error.details.map(
        (d: { field: string }) => d.field
      );
      expect(fields).toEqual(expect.arrayContaining(["fullName", "email"]));
    });
  });

  describe("PUT /:id", () => {
    it("met à jour un candidat existant", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(candidate);
      prismaMock.candidate.update.mockResolvedValue({
        ...candidate,
        phone: "0700000000",
      });

      const res = await request(app)
        .put(`/v1/candidates/${candidate.id}`)
        .set("Authorization", recruiterToken())
        .send({ phone: "0700000000" });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe("0700000000");
    });

    it("renvoie 404 si le candidat n'existe pas", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/v1/candidates/inconnu")
        .set("Authorization", recruiterToken())
        .send({ phone: "0700000000" });

      expect(res.status).toBe(404);
      expect(prismaMock.candidate.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:id", () => {
    it("permet à un ADMIN de supprimer un candidat", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(candidate);
      prismaMock.candidate.delete.mockResolvedValue(candidate);

      const res = await request(app)
        .delete(`/v1/candidates/${candidate.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(prismaMock.candidate.delete).toHaveBeenCalledWith({
        where: { id: candidate.id },
      });
    });

    it("refuse (403) la suppression à un RECRUITER", async () => {
      const res = await request(app)
        .delete(`/v1/candidates/${candidate.id}`)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(403);
      expect(prismaMock.candidate.delete).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le candidat n'existe pas", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete("/v1/candidates/inconnu")
        .set("Authorization", adminToken());

      expect(res.status).toBe(404);
    });
  });
});
