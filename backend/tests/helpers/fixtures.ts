import {
  Application,
  ApplicationStatus,
  Candidate,
  Job,
  Role,
  User,
} from "@prisma/client";

const now = new Date("2026-01-01T00:00:00.000Z");

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  firstName: "Alice",
  lastName: "Martin",
  email: "alice@souverainrecrut.fr",
  password: "$2b$10$hash",
  role: Role.RECRUITER,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const buildCandidate = (
  overrides: Partial<Candidate> = {}
): Candidate => ({
  id: "candidate-1",
  fullName: "Jean Dupont",
  email: "jean.dupont@mail.fr",
  phone: "0612345678",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const buildJob = (overrides: Partial<Job> = {}): Job => ({
  id: "job-1",
  title: "Développeur Backend",
  description: "Développement d'API REST Node.js",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: "user-1",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const buildApplication = (
  overrides: Partial<Application> = {}
): Application => ({
  id: "application-1",
  candidateId: "candidate-1",
  jobId: "job-1",
  status: ApplicationStatus.PENDING,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
