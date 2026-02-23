import { prisma } from "../lib/prisma";
import { z } from "zod";

export const CreateNoteSchema = z.object({
  patientId: z.string().uuid(),
  nurseId: z.string().uuid(),
  shiftId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export const NoteService = {
  async create(data: z.infer<typeof CreateNoteSchema>) {
    return prisma.note.create({
      data,
      include: {
        nurse: { select: { id: true, name: true } },
      },
    });
  },

  async getForPatientShift(patientId: string, shiftId: string) {
    return prisma.note.findMany({
      where: { patientId, shiftId },
      include: { nurse: { select: { id: true, name: true } } },
      orderBy: { timestamp: "desc" },
    });
  },
};
