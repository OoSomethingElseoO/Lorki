import { prisma } from "@/lib/prisma";

export async function openSecurityCase(input: { fingerprint: string; type: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; summary: string; evidence: unknown }) {
  const existing = await prisma.securityCase.findUnique({ where: { fingerprint: input.fingerprint } });
  if (existing && ["OPEN", "INVESTIGATING", "CONTAINED"].includes(existing.status)) return existing;
  if (existing) return prisma.securityCase.update({ where: { id: existing.id }, data: { status: "OPEN", severity: input.severity, summary: input.summary, evidence: JSON.parse(JSON.stringify(input.evidence)) } });
  return prisma.securityCase.create({ data: { fingerprint: input.fingerprint, type: input.type, severity: input.severity, summary: input.summary, evidence: JSON.parse(JSON.stringify(input.evidence)) } });
}
