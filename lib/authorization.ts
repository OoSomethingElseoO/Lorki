import { prisma } from "@/lib/prisma";
import { apiContractError } from "@/lib/api-contract";

/** Stable error shape for API callers and UI forms. */
export function apiError(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return apiContractError(code, message, status, details);
}

export function artistRequired<T extends { id: string }>(user: { artist?: T | null } | null): T | null {
  return user?.artist ?? null;
}

export function conservancyRequired<T extends { id: string }>(user: { conservancy?: T | null } | null): T | null {
  return user?.conservancy ?? null;
}

/** Single-query ownership boundary: the campaign's artist must match. */
export function loadArtistArtwork(artistId: string, artworkId: string) {
  return prisma.artwork.findFirst({ where: { id: artworkId, campaign: { artistId } }, include: { campaign: true } });
}

/** Single-query ownership boundary for artist campaign mutations. */
export function loadArtistCampaign(artistId: string, campaignId: string) {
  return prisma.campaign.findFirst({ where: { id: campaignId, artistId }, include: { animal: true, conservancy: true } });
}

/** Conservancy ownership is always through the authenticated user's profile. */
export function loadOwnedConservancy(conservancyId: string, userId: string) {
  return prisma.conservancy.findFirst({ where: { id: conservancyId, userId } });
}
