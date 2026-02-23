import { prisma } from "../lib/prisma";
import { addMinutes } from "date-fns";
import { TaskType } from "@prisma/client";

const DEMO_TASKS: Array<{ title: string; taskType: TaskType; offsetMinutes: number }> = [
  { title: "Administer morning medication",     taskType: "MEDICATION",     offsetMinutes: -15 }, // OVERDUE
  { title: "Check vital signs",                taskType: "MONITORING",     offsetMinutes:   5 }, // DUE_NOW
  { title: "Blood glucose monitoring",          taskType: "MONITORING",     offsetMinutes:  20 }, // DUE_SOON
  { title: "IV antibiotic administration",      taskType: "MEDICATION",     offsetMinutes:  90 }, // LATER
  { title: "Patient assessment & chart note",   taskType: "CARE_PROCEDURE", offsetMinutes: -15 }, // OVERDUE
  { title: "Post-op wound dressing check",      taskType: "CARE_PROCEDURE", offsetMinutes:   5 }, // DUE_NOW
  { title: "Fluid intake/output documentation", taskType: "ONE_TIME",       offsetMinutes:  20 }, // DUE_SOON
  { title: "Evening medication round",          taskType: "MEDICATION",     offsetMinutes: 120 }, // LATER
];

export const DemoService = {
  async generateDemoData(shiftId: string): Promise<{ tasksCreated: number }> {
    const now = new Date();

    const assignments = await prisma.nurseAssignment.findMany({
      where: { shiftId },
      include: { patient: true },
    });

    // If this shift has no patient assignments, auto-create them from existing active patients
    if (assignments.length === 0) {
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift) return { tasksCreated: 0 };

      const patients = await prisma.patient.findMany({
        where: { isActive: true },
        take: 4,
        orderBy: { bedNumber: "asc" },
      });
      if (patients.length === 0) return { tasksCreated: 0 };

      await Promise.all(
        patients.map((p) =>
          prisma.nurseAssignment.upsert({
            where: { nurseId_patientId_shiftId: { nurseId: shift.nurseId, patientId: p.id, shiftId } },
            create: { nurseId: shift.nurseId, patientId: p.id, shiftId },
            update: {},
          })
        )
      );

      assignments.push(...patients.map((p) => ({ patient: p } as any)));
    }

    const created = await Promise.all(
      DEMO_TASKS.map((template, i) => {
        const patient = assignments[i % assignments.length].patient;
        return prisma.task.upsert({
          where: {
            patientId_title_shiftId: {
              patientId: patient.id,
              title:     template.title,
              shiftId,
            },
          },
          create: {
            patientId:        patient.id,
            taskType:         template.taskType,
            title:            template.title,
            anchorTime:       addMinutes(now, template.offsetMinutes),
            frequencyMinutes: null,
            isActive:         true,
            shiftId,
          },
          update: {}, // already exists — no-op
        });
      })
    );

    return { tasksCreated: created.length };
  },
};
