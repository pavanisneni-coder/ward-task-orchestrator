import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const NurseService = {
  async listWithShiftStatus() {
    const now = new Date();
    const nurses = await prisma.nurse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        shifts: {
          where: {
            archived: false,
            startTime: { lte: now },
            endTime: { gte: now },
          },
          include: {
            assignments: { select: { id: true } },
          },
        },
      },
    });
    return nurses.map(({ shifts, ...nurse }) => ({
      ...nurse,
      hasActiveShift: (shifts[0]?.assignments.length ?? 0) > 0,
      patientCount: shifts[0]?.assignments.length ?? 0,
    }));
  },

  async getById(id: string) {
    const nurse = await prisma.nurse.findUnique({ where: { id } });
    if (!nurse) throw new AppError(404, "Nurse not found", "NURSE_NOT_FOUND");
    return nurse;
  },
};
