/**
 * Configuration Jest du Backend SouverainRecrut.
 *
 * - Tests TypeScript via ts-jest (tsconfig.test.json)
 * - Prisma est mocké (tests/setup/prisma-mock.ts) : aucune base requise
 * - Rapports : coverage/lcov.info (SonarQube) + reports/junit.xml (Jenkins)
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],

  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },

  setupFiles: ["<rootDir>/tests/setup/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/prisma-mock.ts"],

  clearMocks: true,

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts", // point d'entrée (app.listen)
    "!src/config/prisma.ts", // singleton remplacé par le mock
    "!src/docs/**", // annotations Swagger
    "!src/swagger/**",
    "!src/types/**", // déclarations de types
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "cobertura"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "reports",
        outputName: "junit.xml",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
      },
    ],
  ],
};
