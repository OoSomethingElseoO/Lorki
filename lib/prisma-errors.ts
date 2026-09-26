import { Prisma } from "@prisma/client";
import { apiContractError } from "@/lib/api-contract";

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function uniqueConstraintResponse(message: string) {
  return apiContractError("CONFLICT", message, 409);
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export function foreignKeyConstraintResponse(message: string) {
  return apiContractError("CONFLICT", message, 409);
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
