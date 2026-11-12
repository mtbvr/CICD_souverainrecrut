import bcrypt from "bcrypt";
import request from "supertest";
import { Role } from "@prisma/client";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { adminToken, recruiterToken } from "../helpers/auth";
import { buildUser } from "../helpers/fixtures";

describe("API – utilisateurs (/v1/users, ADMIN uniquement)", () => {
  const user = buildUser();

  describe("contrôle d'accès", () => {
    it.each([
      ["get", "/v1/users"],
      ["get", "/v1/users/user-1"],
      ["post", "/v1/users"],
      ["put", "/v1/users/user-1"],
      ["delete", "/v1/users/user-1"],
    ] as const)("refuse (403) %s %s à un RECRUITER", async (method, url) => {
      const res = await request(app)
        [method](url)
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(403);
    });
  });

  describe("GET /", () => {
    it("retourne la liste paginée des utilisateurs", async () => {
      prismaMock.user.findMany.mockResolvedValue([user]);
      prismaMock.user.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/v1/users")
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe("GET /:id", () => {
    it("retourne l'utilisateur demandé", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);

      const res = await request(app)
        .get(`/v1/users/${user.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(user.email);
    });

    it("renvoie 404 pour un utilisateur inexistant", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/users/inconnu")
        .set("Authorization", adminToken());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Utilisateur introuvable.");
    });
  });

  describe("POST /", () => {
    const payload = {
      firstName: "Bob",
      lastName: "Durand",
      email: "bob@souverainrecrut.fr",
      password: "Password123!",
      role: Role.RECRUITER,
    };

    it("crée un utilisateur avec un mot de passe haché", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(buildUser());

      const res = await request(app)
        .post("/v1/users")
        .set("Authorization", adminToken())
        .send(payload);

      expect(res.status).toBe(201);

      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data.password).not.toBe(payload.password);
      expect(await bcrypt.compare(payload.password, data.password)).toBe(true);
    });

    it("renvoie 409 si l'email est déjà utilisé", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);

      const res = await request(app)
        .post("/v1/users")
        .set("Authorization", adminToken())
        .send(payload);

      expect(res.status).toBe(409);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("renvoie 400 si le mot de passe est trop court", async () => {
      const res = await request(app)
        .post("/v1/users")
        .set("Authorization", adminToken())
        .send({ ...payload, password: "court" });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe("password");
    });
  });

  describe("PUT /:id", () => {
    it("met à jour un utilisateur existant", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue({ ...user, firstName: "Alicia" });

      const res = await request(app)
        .put(`/v1/users/${user.id}`)
        .set("Authorization", adminToken())
        .send({ firstName: "Alicia" });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("Alicia");
    });

    it("renvoie 404 si l'utilisateur n'existe pas", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/v1/users/inconnu")
        .set("Authorization", adminToken())
        .send({ firstName: "Alicia" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("supprime un utilisateur existant", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.delete.mockResolvedValue(user);

      const res = await request(app)
        .delete(`/v1/users/${user.id}`)
        .set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: user.id },
      });
    });
  });
});
