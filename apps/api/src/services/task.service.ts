import { TaskType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { differenceInMinutes } from "date-fns";
import { computeTaskUrgency, computeUrgencyBucket, getNextOccurrence, UrgencyBucket } from "../lib/time";
import { z } from "zod";

export const CreateTaskSchema = z.object({
  patientId: z.string().uuid(),
  taskType: z.nativeEnum(TaskType),
  title: z.string().min(1).max(255),
  frequencyMinutes: z.number().int().positive().nullable().optional(),
  anchorTime: z.string().datetime(),
  graceMinutes: z.number().int().min(0).optional(),
  lookaheadMinutes: z.number().int().min(0).optional(),
});

export const UpdateTaskSchema = z.object({
  action: z.literal("discontinue"),
});

// Default grace periods per task type (Build Spec §8.3)
const DEFAULT_GRACE: Record<TaskType, number> = {
  MEDICATION: 30,
  MONITORING: 10,
  CARE_PROCEDURE: 20,
  ONE_TIME: 60,
};

const DEFAULT_LOOKAHEAD: Record<TaskType, number> = {
  MEDICATION: 60,
  MONITORING: 20,
  CARE_PROCEDURE: 40,
  ONE_TIME: 120,
};

export interface EnrichedTask {
  id: string;
  patientId: string;
  patient: { id: string; name: string; bedNumber: string; age: number | null; gender: string | null; status: string };
  taskType: TaskType;
  title: string;
  frequencyMinutes: number | null;
  anchorTime: Date;
  graceMinutes: number;
  lookaheadMinutes: number;
  isActive: boolean;
  bucket: UrgencyBucket;
  nextDueTime: Date;
  minutesUntilDue: number;
  missedIntervals: number;
  lastLog: { completedAt: Date; wasSkipped: boolean; skipReason: string | null; nurse: { name: string } } | null;
}

export const TaskService = {
  async getForPatient(patientId: string) {
    return prisma.task.findMany({
      where: { patientId, isActive: true },
      orderBy: { anchorTime: "asc" },
    });
  },

  async getEnrichedForShift(shiftId: string, nurseId?: string): Promise<EnrichedTask[]> {
    // Get all patients assigned to this shift (or this nurse's patients)
    const assignmentWhere = nurseId ? { shiftId, nurseId } : { shiftId };
    const assignments = await prisma.nurseAssignment.findMany({
      where: assignmentWhere,
      include: {
        patient: {
          include: {
            tasks: {
              where: { isActive: true, OR: [{ shiftId: null }, { shiftId }] },
              include: {
                taskLogs: {
                  where: { shiftId },
                  orderBy: { completedAt: "desc" },
                  take: 1,
                  include: { nurse: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });

    // Pre-fetch taskIds that have been completed (not skipped) in this shift.
    // Undo deletes the TaskLog entirely, so any existing row means "not undone".
    const completedLogs = await prisma.taskLog.findMany({
      where: {
        shiftId,
        wasSkipped: false,
        ...(nurseId ? { nurseId } : {}),
      },
      select: { taskId: true },
    });
    const completedTaskIds = new Set(completedLogs.map((l) => l.taskId));

    const enriched: EnrichedTask[] = [];
    const now = new Date();

    for (const assignment of assignments) {
      for (const task of assignment.patient.tasks) {
        // Exclude tasks already completed in this shift (pre-filter covers both one-time and recurring)
        if (completedTaskIds.has(task.id)) continue;
        const lastLog = task.taskLogs[0] ?? null;
        // Completed one-time task — remove permanently from active list
        if (lastLog && !lastLog.wasSkipped && task.frequencyMinutes === null) continue;
        // Manual skip (any task type) — remove for the rest of this shift
        if (lastLog?.wasSkipped && lastLog.skipReason !== "auto-missed") continue;
        // Auto-missed recurring task — falls through so the next occurrence is computed below
        const lastLoggedTime = lastLog ? lastLog.completedAt : null;

        const urgency = computeTaskUrgency(
          task.anchorTime,
          task.frequencyMinutes,
          task.graceMinutes,
          task.lookaheadMinutes,
          lastLoggedTime,
          now
        );

        const baseEntry = {
          id: task.id,
          patientId: task.patientId,
          patient: {
            id: assignment.patient.id,
            name: assignment.patient.name,
            bedNumber: assignment.patient.bedNumber,
            age: assignment.patient.age,
            gender: assignment.patient.gender,
            status: assignment.patient.status,
          },
          taskType: task.taskType,
          title: task.title,
          frequencyMinutes: task.frequencyMinutes,
          anchorTime: task.anchorTime,
          graceMinutes: task.graceMinutes,
          lookaheadMinutes: task.lookaheadMinutes,
          isActive: task.isActive,
          lastLog: lastLog
            ? { completedAt: lastLog.completedAt, wasSkipped: lastLog.wasSkipped, skipReason: lastLog.skipReason, nurse: lastLog.nurse }
            : null,
        };

        const minutesOverdue = urgency.bucket === "OVERDUE" ? -urgency.minutesUntilDue : 0;
        const shouldAutoMiss =
          task.frequencyMinutes !== null &&
          task.frequencyMinutes >= 60 &&
          minutesOverdue > task.frequencyMinutes * 0.25;

        if (!shouldAutoMiss) {
          enriched.push({ ...baseEntry, bucket: urgency.bucket, nextDueTime: urgency.nextDueTime, minutesUntilDue: urgency.minutesUntilDue, missedIntervals: urgency.missedIntervals });
        } else {
          // Create a "missed" TaskLog once per occurrence so it appears in Task History
          const alreadyMissed =
            lastLog?.wasSkipped === true &&
            lastLog.skipReason === "auto-missed" &&
            lastLog.completedAt >= urgency.nextDueTime; // log timestamp is after the overdue time → same occurrence

          if (!alreadyMissed) {
            await prisma.taskLog.create({
              data: {
                taskId:      task.id,
                nurseId:     assignment.nurseId,
                shiftId,
                patientId:   task.patientId,
                completedAt: now,
                wasOverdue:  true,
                wasSkipped:  true,
                skipReason:  "auto-missed",
              },
            });
          }
        }

        // If OVERDUE and recurring: also push the next upcoming occurrence
        if (urgency.bucket === "OVERDUE" && task.frequencyMinutes !== null) {
          const nextTime = getNextOccurrence(urgency.nextDueTime, task.frequencyMinutes);
          enriched.push({
            ...baseEntry,
            bucket: computeUrgencyBucket(nextTime, now),
            nextDueTime: nextTime,
            minutesUntilDue: differenceInMinutes(nextTime, now),
            missedIntervals: 0,
          });
        }
      }
    }

    // Sort: OVERDUE first, then DUE_NOW, DUE_SOON, LATER — within each by nextDueTime
    const bucketOrder: Record<UrgencyBucket, number> = {
      OVERDUE: 0,
      DUE_NOW: 1,
      DUE_SOON: 2,
      LATER: 3,
      COMPLETED: 4,
    };

    return enriched.sort((a, b) => {
      const bucketDiff = bucketOrder[a.bucket] - bucketOrder[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.nextDueTime.getTime() - b.nextDueTime.getTime();
    });
  },

  async create(data: z.infer<typeof CreateTaskSchema>) {
    const taskType = data.taskType;
    return prisma.task.create({
      data: {
        ...data,
        anchorTime: new Date(data.anchorTime),
        graceMinutes: data.graceMinutes ?? DEFAULT_GRACE[taskType],
        lookaheadMinutes: data.lookaheadMinutes ?? DEFAULT_LOOKAHEAD[taskType],
        frequencyMinutes: data.frequencyMinutes ?? null,
      },
    });
  },

  async discontinue(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new AppError(404, "Task not found", "TASK_NOT_FOUND");
    if (!task.isActive) throw new AppError(400, "Task already discontinued", "TASK_INACTIVE");

    return prisma.task.update({
      where: { id: taskId },
      data: { isActive: false },
    });
  },
};
