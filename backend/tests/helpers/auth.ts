import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

/**
 * Génère un header Authorization valide pour un rôle donné.
 */
export const bearer = (role: Role, id = `${role.toLowerCase()}-id`): string =>
  `Bearer ${jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  })}`;

export const adminToken = (): string => bearer(Role.ADMIN);
export const recruiterToken = (): string => bearer(Role.RECRUITER);
