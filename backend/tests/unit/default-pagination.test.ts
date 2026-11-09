import { ApplicationRepository } from "../../src/repositories/application.repository";
import { CandidateRepository } from "../../src/repositories/candidate.repository";
import { JobRepository } from "../../src/repositories/job.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { ApplicationService } from "../../src/services/application.service";
import { CandidateService } from "../../src/services/candidate.service";
import { JobService } from "../../src/services/job.service";
import { UserService } from "../../src/services/user.service";
import { prismaMock } from "../setup/prisma-mock";

/**
 * Sans paramètres, les listes utilisent la pagination par défaut
 * (skip = 0, take = 10) au niveau service comme repository.
 */
describe("pagination par défaut des services et repositories", () => {
  const delegates = {
    application: prismaMock.application,
    candidate: prismaMock.candidate,
    job: prismaMock.job,
    user: prismaMock.user,
  };

  const cases = [
    ["ApplicationRepository", "application", () => new ApplicationRepository().findAll()],
    ["CandidateRepository", "candidate", () => new CandidateRepository().findAll()],
    ["JobRepository", "job", () => new JobRepository().findAll()],
    ["UserRepository", "user", () => new UserRepository().findAll()],
    ["ApplicationService", "application", () => new ApplicationService().getAll()],
    ["CandidateService", "candidate", () => new CandidateService().getAll()],
    ["JobService", "job", () => new JobService().getAll()],
    ["UserService", "user", () => new UserService().getAll()],
  ] as const;

  it.each(cases)("%s utilise skip=0 et take=10", async (_name, model, call) => {
    const delegate = delegates[model];
    (delegate.findMany as jest.Mock).mockResolvedValue([]);
    (delegate.count as jest.Mock).mockResolvedValue(0);

    await expect(call()).resolves.toEqual({ items: [], total: 0 });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
  });
});
