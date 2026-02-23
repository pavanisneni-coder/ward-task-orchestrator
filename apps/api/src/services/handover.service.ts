import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const HandoverService = {
  async generateSummary(shiftId: string, handoverNurseId?: string): Promise<string> {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        nurse: true,
        assignments: {
          include: {
            patient: {
              include: {
                tasks: { where: { isActive: true } },
              },
            },
          },
        },
        taskLogs: {
          include: {
            task: true,
            patient: { select: { name: true, bedNumber: true } },
            nurse: { select: { name: true } },
          },
          orderBy: { completedAt: "asc" },
        },
        notes: {
          include: {
            patient: { select: { name: true, bedNumber: true } },
            nurse: { select: { name: true } },
          },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!shift) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");

    let handoverNurseName = "incoming nurse";
    if (handoverNurseId) {
      const nurse = await prisma.nurse.findUnique({ where: { id: handoverNurseId }, select: { name: true } });
      if (nurse) handoverNurseName = nurse.name;
    }

    const completed = shift.taskLogs.filter((l) => !l.wasSkipped);
    const skipped = shift.taskLogs.filter((l) => l.wasSkipped);
    const overdue = shift.taskLogs.filter((l) => l.wasOverdue);

    // Build structured context for AI
    const context = {
      shiftInfo: {
        nurse: shift.nurse.name,
        role: shift.nurse.role,
        ward: "Ward 3B - Acute Care",
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        handoverTo: handoverNurseName,
      },
      patientCount: shift.assignments.length,
      taskSummary: {
        total: shift.taskLogs.length,
        completed: completed.length,
        skipped: skipped.length,
        completedOverdue: overdue.length,
      },
      completedTasks: completed.map((l) => ({
        patient: `${l.patient.name} (Bed ${l.patient.bedNumber})`,
        task: l.task.title,
        type: l.task.taskType,
        completedAt: l.completedAt.toISOString(),
        completedBy: l.nurse.name,
        wasOverdue: l.wasOverdue,
      })),
      skippedTasks: skipped.map((l) => ({
        patient: `${l.patient.name} (Bed ${l.patient.bedNumber})`,
        task: l.task.title,
        reason: l.skipReason,
        skippedBy: l.nurse.name,
        at: l.completedAt.toISOString(),
      })),
      notes: shift.notes.map((n) => ({
        patient: `${n.patient.name} (Bed ${n.patient.bedNumber})`,
        content: n.content,
        addedBy: n.nurse.name,
        at: n.timestamp.toISOString(),
      })),
    };

    const prompt = `You are a clinical handover assistant for an Indian hospital ward.
Generate a concise, factual shift handover summary from the following structured data.
Write in third person, past tense. Be clinical and clear.
Format: Start with a brief overview (including handover recipient if provided), then Critical Events (if any), then Patient Movement, then Medication Updates.
Do NOT provide clinical recommendations. Do NOT interpret or diagnose. Descriptive only.
Use Indian naming conventions and hospital terminology.

DATA:
${JSON.stringify(context, null, 2)}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content ?? "Summary could not be generated.";
    } catch (error) {
      console.error("[OpenAI Error]", error);
      // Fallback: generate deterministic summary without AI
      return generateFallbackSummary(context);
    }
  },

  async getShiftStats(shiftId: string) {
    const [logs, notes, assignments] = await Promise.all([
      prisma.taskLog.findMany({
        where: { shiftId },
        include: {
          task: { select: { title: true, taskType: true } },
          patient: { select: { name: true, bedNumber: true } },
          nurse: { select: { name: true } },
        },
        orderBy: { completedAt: "asc" },
      }),
      prisma.note.findMany({
        where: { shiftId },
        include: { nurse: { select: { name: true } } },
        orderBy: { timestamp: "desc" },
      }),
      prisma.nurseAssignment.findMany({
        where: { shiftId },
        include: {
          patient: {
            include: { tasks: { where: { isActive: true } } },
          },
        },
      }),
    ]);

    return {
      logs,
      notes,
      assignments,
      stats: {
        completed: logs.filter((l) => !l.wasSkipped).length,
        skipped: logs.filter((l) => l.wasSkipped).length,
        overdue: logs.filter((l) => l.wasOverdue).length,
        patientCount: assignments.length,
      },
    };
  },
};

function generateFallbackSummary(context: any): string {
  const { shiftInfo, taskSummary, skippedTasks, notes } = context;
  const start = new Date(shiftInfo.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const end = new Date(shiftInfo.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  let summary = `The shift (${start}–${end}) managed ${context.patientCount} patients. `;
  summary += `Total of ${taskSummary.completed} tasks were completed`;
  if (taskSummary.skipped > 0) summary += ` and ${taskSummary.skipped} were skipped`;
  summary += `. `;
  if (taskSummary.completedOverdue > 0) {
    summary += `${taskSummary.completedOverdue} tasks were completed after their grace window. `;
  }
  if (skippedTasks?.length > 0) {
    summary += `Skipped tasks: ${skippedTasks.map((s: any) => `${s.task} for ${s.patient} (${s.reason})`).join("; ")}. `;
  }
  if (notes?.length > 0) {
    summary += `Clinical notes were recorded for ${notes.length} patient(s). Please review handover notes for details.`;
  }
  return summary;
}
