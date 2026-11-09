import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Role } from "@prisma/client";

import app from "../../src/app";
import { prismaMock } from "../setup/prisma-mock";
import { bearer } from "../helpers/auth";
import { buildUser } from "../helpers/fixtures";

const PASSWORD = "Password123!";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

describe("API – authentification", () => {
  describe("POST /v1/auth/login", () => {
    it("retourne un JWT et l'utilisateur sans mot de passe", async () => {
      const user = buildUser({ password: passwordHash, role: Role.ADMIN });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: user.email, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        id: user.id,
        email: user.email,
      });
      expect(res.body.data.user).not.toHaveProperty("password");

      const payload = jwt.verify(
        res.body.data.token,
        process.env.JWT_SECRET as string
      ) as jwt.JwtPayload;
      expect(payload).toMatchObject({ id: user.id, role: Role.ADMIN });
    });

    it("refuse (401) un email inconnu", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "inconnu@mail.fr", password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
    });

    it("refuse (401) un mot de passe incorrect", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        buildUser({ password: passwordHash })
      );

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "alice@souverainrecrut.fr", password: "mauvais" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /v1/auth/me", () => {
    it("retourne le profil de l'utilisateur connecté", async () => {
      const { password: _password, ...profile } = buildUser({ id: "user-42" });
      prismaMock.user.findUnique.mockResolvedValue(profile as never);

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", bearer(Role.RECRUITER, "user-42"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("user-42");
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "user-42" } })
      );
    });

    it("renvoie 404 si l'utilisateur n'existe plus", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", bearer(Role.RECRUITER));

      expect(res.status).toBe(404);
    });
  });

  describe("contrôle du token (authMiddleware)", () => {
    it("refuse (401) une requête sans header Authorization", async () => {
      const res = await request(app).get("/v1/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Authentification requise.");
    });

    it("refuse (401) un schéma autre que Bearer", async () => {
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", "Basic dXNlcjpwYXNz");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token invalide.");
    });

    it("refuse (401) un header Bearer sans token", async () => {
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", "Bearer");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token invalide.");
    });

    it("refuse (401) un token signé avec une autre clé", async () => {
      const forged = jwt.sign({ id: "x", role: Role.ADMIN }, "autre-cle");

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token invalide ou expiré.");
    });

    it("refuse (401) un token expiré", async () => {
      const expired = jwt.sign(
        { id: "x", role: Role.ADMIN },
        process.env.JWT_SECRET as string,
        { expiresIn: -10 }
      );

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${expired}`);

      expect(res.status).toBe(401);
    });
  });
});
