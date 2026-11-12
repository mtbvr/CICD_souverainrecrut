import { NextFunction, Request, Response } from "express";

import { AppError } from "../../src/errors/app.error";
import { asyncHandler } from "../../src/utils/async-handler";
import {
  buildPaginationMeta,
  getPagination,
} from "../../src/utils/pagination";

describe("utils/pagination", () => {
  describe("getPagination", () => {
    it("applique les valeurs par défaut (page 1, limite 10)", () => {
      expect(getPagination()).toEqual({ page: 1, limit: 10, skip: 0 });
    });

    it("calcule le décalage à partir de la page et de la limite", () => {
      expect(getPagination("3", "20")).toEqual({
        page: 3,
        limit: 20,
        skip: 40,
      });
    });

    it("ramène une page négative ou nulle à 1", () => {
      expect(getPagination("-5", "10").page).toBe(1);
      expect(getPagination("0", "10").page).toBe(1);
    });

    it("borne la limite entre 1 et 100", () => {
      expect(getPagination("1", "0").limit).toBe(1);
      expect(getPagination("1", "500").limit).toBe(100);
    });
  });

  describe("buildPaginationMeta", () => {
    it("calcule le nombre total de pages", () => {
      expect(buildPaginationMeta(1, 10, 25)).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("retourne 0 page quand il n'y a aucun élément", () => {
      expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(0);
    });
  });
});

describe("utils/asyncHandler", () => {
  const req = {} as Request;
  const res = {} as Response;

  it("transmet les erreurs asynchrones à next()", async () => {
    const error = new Error("boom");
    const next = jest.fn() as NextFunction;

    asyncHandler(async () => {
      throw error;
    })(req, res, next);

    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("n'appelle pas next() quand le handler réussit", async () => {
    const next = jest.fn() as NextFunction;

    asyncHandler(async () => "ok")(req, res, next);

    await new Promise(setImmediate);

    expect(next).not.toHaveBeenCalled();
  });
});

describe("errors/AppError", () => {
  it("porte le message et le code HTTP fournis", () => {
    const error = new AppError("Introuvable", 404);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Introuvable");
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it("utilise le code 500 par défaut", () => {
    expect(new AppError("Erreur").statusCode).toBe(500);
  });
});
