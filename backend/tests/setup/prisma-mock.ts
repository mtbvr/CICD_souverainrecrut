import { PrismaClient } from "@prisma/client";
import { DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";

import { prisma } from "../../src/config/prisma";

/**
 * Remplace le singleton Prisma par un mock profond :
 * chaque test définit les réponses attendues de la base.
 */
jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
