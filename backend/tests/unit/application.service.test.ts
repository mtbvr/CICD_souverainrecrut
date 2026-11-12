import { ApplicationStatus } from "@prisma/client";

import { ApplicationService } from "../../src/services/application.service";
import { prismaMock } from "../setup/prisma-mock";
import { buildApplication } from "../helpers/fixtures";

/**
 * updateStatus() n'est exposé par aucune route : testé directement.
 */
describe("ApplicationService.updateStatus", () => {
  const service = new ApplicationService();

  it("met à jour uniquement le statut", async () => {
    const application = buildApplication();
    prismaMock.application.findUnique.mockResolvedValue(application);
    prismaMock.application.update.mockResolvedValue({
      ...application,
      status: ApplicationStatus.REVIEWED,
    });

    const result = await service.updateStatus(
      application.id,
      ApplicationStatus.REVIEWED
    );

    expect(result.status).toBe(ApplicationStatus.REVIEWED);
    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: application.id },
        data: { status: ApplicationStatus.REVIEWED },
      })
    );
  });

  it("lève une 404 si la candidature n'existe pas", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus("inconnue", ApplicationStatus.REJECTED)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.application.update).not.toHaveBeenCalled();
  });
});
