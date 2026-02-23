import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { isOverdue, computeNextDueTime } from "../lib/time";
import { z } from "zod";

export const CompleteTaskSchema = z.object({
  taskId: z.string().uuid(),
  nurseId: z.string().uuid(),
  shiftId: z.string().uuid(),
  action: z.literal("complete"),
});

export const SkipTaskSchema = z.object({
  taskId: z.string().uuid(),
  nurseId: z.string().uuid(),
  shiftId: z.string().uuid(),
  action: z.literal("skip"),
  reason: z.string().min(1).max(500),
});

export const TaskLogInputSchema = z.discriminatedUnion("action", [
  CompleteTaskSchema,
  SkipTaskSchema,
]);

export const TaskLogService = {
  async logTask(input: z.infer<typeof TaskLogInputSchema>) {
    const task = await prisma.task.findUnique({
      where: { id: input.taskId, isActive: true },
    });
    if (!task) throw new AppError(404, "Task not found or inactive", "TASK_NOT_FOUND");

    const [nurse, shift] = await Promise.all([
      prisma.nurse.findUnique({ where: { id: input.nurseId } }),
      prisma.shift.findUnique({ where: { id: input.shiftId } }),
    ]);
    if (!nurse) throw new AppError(404, "Nurse not found", "NURSE_NOT_FOUND");
    if (!shift) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");

    // Server-side timestamp (Build Spec: no client timestamps)
    const now = new Date();

    // Compute if overdue
    const lastLog = await prisma.taskLog.findFirst({
      where: { taskId: input.taskId, wasSkipped: false },
      orderBy: { completedAt: "desc" },
    });
    const lastLoggedTime = lastLog ? lastLog.completedAt : null;
    const nextDue = computeNextDueTime(task.anchorTime, task.frequencyMinutes, lastLoggedTime);
    const wasOverdue = isOverdue(nextDue, task.graceMinutes, now);

    return prisma.taskLog.create({
      data: {
        taskId: input.taskId,
        nurseId: input.nurseId,
        shiftId: input.shiftId,
        patientId: task.patientId,
        completedAt: now,
        wasOverdue,
        wasSkipped: input.action === "skip",
        skipReason: input.action === "skip" ? input.reason : null,
      },
      include: {
        nurse: { select: { id: true, name: true, role: true } },
        task: { select: { id: true, title: true, taskType: true } },
      },
    });
  },

  async undo(logId: string) {
    const log = await prisma.taskLog.findUnique({ where: { id: logId } });
    if (!log) throw new AppError(404, "Log not found", "LOG_NOT_FOUND");

    // 15-second undo window (Build Spec §7)
    const secondsSinceLog = (Date.now() - log.completedAt.getTime()) / 1000;
    if (secondsSinceLog > 15) {
      throw new AppError(409, "Undo window has expired (15 seconds)", "UNDO_EXPIRED");
    }

    await prisma.taskLog.delete({ where: { id: logId } });
    return { success: true, message: "Task log undone successfully" };
  },

  async getForShift(shiftId: string) {
    return prisma.taskLog.findMany({
      where: { shiftId },
      include: {
        nurse: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskType: true } },
        patient: { select: { id: true, name: true, bedNumber: true } },
      },
      orderBy: { completedAt: "desc" },
    });
  },
};
