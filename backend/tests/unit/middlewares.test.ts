import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../src/errors/app.error";
import { authorize } from "../../src/middlewares/authorize.middleware";
import { errorMiddleware } from "../../src/middlewares/error.middleware";
import { validate } from "../../src/middlewares/validate.middleware";

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("middlewares/authorize", () => {
  it("refuse (401) une requête sans utilisateur authentifié", () => {
    const next = jest.fn() as NextFunction;

    authorize(Role.ADMIN)({} as Request, mockResponse(), next);

    const error = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
  });

  it("refuse (403) un rôle non autorisé", () => {
    const next = jest.fn() as NextFunction;
    const req = { user: { id: "u1", role: Role.RECRUITER } } as Request;

    authorize(Role.ADMIN)(req, mockResponse(), next);

    const error = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it("laisse passer un rôle autorisé", () => {
    const next = jest.fn() as NextFunction;
    const req = { user: { id: "u1", role: Role.ADMIN } } as Request;

    authorize(Role.ADMIN, Role.RECRUITER)(req, mockResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe("middlewares/validate", () => {
  const schema = z.object({ name: z.string().min(2) });

  it("retourne 400 avec le détail des champs invalides", () => {
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    validate(schema)({ body: { name: "a" } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          details: [expect.objectContaining({ field: "name" })],
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("remplace le body par les données validées", () => {
    const req = { body: { name: "Alice", extra: true } } as Request;
    const next = jest.fn() as NextFunction;

    validate(schema)(req, mockResponse(), next);

    expect(req.body).toEqual({ name: "Alice" });
    expect(next).toHaveBeenCalled();
  });
});

describe("middlewares/error", () => {
  it("renvoie le code et le message d'une AppError", () => {
    const res = mockResponse();

    errorMiddleware(
      new AppError("Conflit", 409),
      {} as Request,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { status: 409, message: "Conflit" },
    });
  });

  it("masque les erreurs inattendues derrière un 500 générique", () => {
    const res = mockResponse();
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    errorMiddleware(
      new Error("détail interne"),
      {} as Request,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { status: 500, message: "Erreur interne du serveur." },
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
