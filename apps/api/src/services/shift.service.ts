import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { z } from "zod";

export const CreateShiftSchema = z.object({
  nurseId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

function getCurrentShiftBounds(now: Date): { start: Date; end: Date } {
  const h = now.getHours();
  const totalMins = h * 60 + now.getMinutes();
  const start = new Date(now);
  const end = new Date(now);

  // Within 30 min before evening start (14:30–15:00) → assign evening shift
  if (totalMins >= 14 * 60 + 30 && totalMins < 15 * 60) {
    start.setHours(15, 0, 0, 0); end.setHours(23, 0, 0, 0);
  // Within 30 min before night start (22:30–23:00) → assign night shift
  } else if (totalMins >= 22 * 60 + 30 && totalMins < 23 * 60) {
    start.setHours(23, 0, 0, 0);
    end.setDate(end.getDate() + 1); end.setHours(7, 0, 0, 0);
  // Within 30 min before morning start (06:30–07:00) → assign morning shift
  } else if (totalMins >= 6 * 60 + 30 && totalMins < 7 * 60) {
    start.setHours(7, 0, 0, 0); end.setHours(15, 0, 0, 0);
  // Normal morning window
  } else if (totalMins >= 7 * 60 && totalMins < 15 * 60) {
    start.setHours(7, 0, 0, 0); end.setHours(15, 0, 0, 0);
  // Normal evening window
  } else if (totalMins >= 15 * 60 && totalMins < 23 * 60) {
    start.setHours(15, 0, 0, 0); end.setHours(23, 0, 0, 0);
  // Night window: 23:00–07:00 next day
  } else if (h >= 23) {
    start.setHours(23, 0, 0, 0);
    end.setDate(end.getDate() + 1); end.setHours(7, 0, 0, 0);
  // 00:00–06:30: mid-night shift (started yesterday at 23:00)
  } else {
    start.setDate(start.getDate() - 1); start.setHours(23, 0, 0, 0);
    end.setHours(7, 0, 0, 0);
  }
  return { start, end };
}

export const ShiftService = {
  async getActiveForNurse(nurseId: string) {
    const now = new Date();
    const thirtyAhead = new Date(now.getTime() + 30 * 60 * 1000);
    return prisma.shift.findFirst({
      where: {
        nurseId,
        archived: false,
        startTime: { lte: thirtyAhead },
        endTime: { gte: now },
      },
      orderBy: { startTime: "desc" },
    });
  },

  async getOrCreateActiveShift(nurseId: string) {
    const existing = await this.getActiveForNurse(nurseId);
    if (existing) return existing;

    const { start, end } = getCurrentShiftBounds(new Date());
    return prisma.shift.create({
      data: { nurseId, startTime: start, endTime: end },
    });
  },

  async archive(shiftId: string) {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");

    return prisma.shift.update({
      where: { id: shiftId },
      data: { archived: true },
    });
  },

  async getById(shiftId: string) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { nurse: true },
    });
    if (!shift) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");
    return shift;
  },
};
