import { prisma } from "../lib/prisma";
import { z } from "zod";
import { AppError } from "../middleware/errorHandler";

export const AssignPatientSchema = z.object({
  nurseId: z.string().uuid(),
  patientId: z.string().uuid(),
  shiftId: z.string().uuid(),
});

export const AssignmentService = {
  async getForShift(shiftId: string) {
    return prisma.nurseAssignment.findMany({
      where: { shiftId },
      include: {
        patient: {
          include: {
            tasks: { where: { isActive: true } },
            notes: {
              where: { shiftId },
              orderBy: { timestamp: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { patient: { bedNumber: "asc" } },
    });
  },

  async assign(data: z.infer<typeof AssignPatientSchema>) {
    const existing = await prisma.nurseAssignment.findUnique({
      where: { nurseId_patientId_shiftId: data },
    });
    if (existing) return existing;

    return prisma.nurseAssignment.create({ data });
  },

  async remove(id: string) {
    const assignment = await prisma.nurseAssignment.findUnique({ where: { id } });
    if (!assignment) throw new AppError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
    return prisma.nurseAssignment.delete({ where: { id } });
  },
};
