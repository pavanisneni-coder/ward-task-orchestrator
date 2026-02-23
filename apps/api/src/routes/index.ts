import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { NurseService } from "../services/nurse.service";
import { ShiftService } from "../services/shift.service";
import { AssignmentService, AssignPatientSchema } from "../services/assignment.service";
import { TaskService, CreateTaskSchema, UpdateTaskSchema } from "../services/task.service";
import { TaskLogService, TaskLogInputSchema } from "../services/taskLog.service";
import { NoteService, CreateNoteSchema } from "../services/note.service";
import { HandoverService } from "../services/handover.service";
import { DemoService } from "../services/demo.service";
import { successResponse } from "../middleware/errorHandler";

const router = Router();

// ─── Nurses ───────────────────────────────────────────────────────────────────
router.get("/nurses", async (_req, res, next) => {
  try {
    const nurses = await NurseService.listWithShiftStatus();
    successResponse(res, nurses);
  } catch (e) { next(e); }
});

// ─── Patients ─────────────────────────────────────────────────────────────────
router.get("/patients", async (_req, res, next) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { bedNumber: "asc" },
      include: {
        assignments: {
          include: {
            nurse: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
    successResponse(res, patients);
  } catch (e) { next(e); }
});

router.get("/nurses/:id", async (req, res, next) => {
  try {
    const nurse = await NurseService.getById(req.params.id);
    successResponse(res, nurse);
  } catch (e) { next(e); }
});

// ─── Shifts ───────────────────────────────────────────────────────────────────
router.get("/shifts/active", async (req, res, next) => {
  try {
    const { nurse_id } = req.query;
    if (!nurse_id || typeof nurse_id !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "nurse_id query param required" } });
    }
    const shift = await ShiftService.getOrCreateActiveShift(nurse_id);
    successResponse(res, shift);
  } catch (e) { next(e); }
});

router.patch("/shifts/:id", async (req, res, next) => {
  try {
    const { archived } = req.body;
    if (archived === true) {
      const shift = await ShiftService.archive(req.params.id);
      successResponse(res, shift);
    } else {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Only archiving supported" } });
    }
  } catch (e) { next(e); }
});

// ─── Assignments ──────────────────────────────────────────────────────────────
router.get("/assignments", async (req, res, next) => {
  try {
    const { shift_id } = req.query;
    if (!shift_id || typeof shift_id !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "shift_id query param required" } });
    }
    const assignments = await AssignmentService.getForShift(shift_id);
    successResponse(res, assignments);
  } catch (e) { next(e); }
});

router.post("/assignments", async (req, res, next) => {
  try {
    const data = AssignPatientSchema.parse(req.body);
    const assignment = await AssignmentService.assign(data);
    successResponse(res, assignment, 201);
  } catch (e) { next(e); }
});

router.delete("/assignments/:id", async (req, res, next) => {
  try {
    await AssignmentService.remove(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
router.get("/tasks", async (req, res, next) => {
  try {
    const { patient_id, shift_id, nurse_id } = req.query;

    if (shift_id && typeof shift_id === "string") {
      const enriched = await TaskService.getEnrichedForShift(
        shift_id,
        typeof nurse_id === "string" ? nurse_id : undefined
      );
      return successResponse(res, enriched);
    }

    if (patient_id && typeof patient_id === "string") {
      const tasks = await TaskService.getForPatient(patient_id);
      return successResponse(res, tasks);
    }

    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "shift_id or patient_id required" } });
  } catch (e) { next(e); }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const data = CreateTaskSchema.parse(req.body);
    const task = await TaskService.create(data);
    successResponse(res, task, 201);
  } catch (e) { next(e); }
});

router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const { action } = UpdateTaskSchema.parse(req.body);
    if (action === "discontinue") {
      const task = await TaskService.discontinue(req.params.id);
      successResponse(res, task);
    }
  } catch (e) { next(e); }
});

// ─── Task Logs ────────────────────────────────────────────────────────────────
router.post("/task-log", async (req, res, next) => {
  try {
    const data = TaskLogInputSchema.parse(req.body);
    const log = await TaskLogService.logTask(data);
    successResponse(res, log, 201);
  } catch (e) { next(e); }
});

router.delete("/task-log/:id/undo", async (req, res, next) => {
  try {
    const result = await TaskLogService.undo(req.params.id);
    successResponse(res, result);
  } catch (e) { next(e); }
});

router.get("/task-log", async (req, res, next) => {
  try {
    const { shift_id } = req.query;
    if (!shift_id || typeof shift_id !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "shift_id required" } });
    }
    const logs = await TaskLogService.getForShift(shift_id);
    successResponse(res, logs);
  } catch (e) { next(e); }
});

// ─── Notes ────────────────────────────────────────────────────────────────────
router.post("/notes", async (req, res, next) => {
  try {
    const data = CreateNoteSchema.parse(req.body);
    const note = await NoteService.create(data);
    successResponse(res, note, 201);
  } catch (e) { next(e); }
});

router.get("/notes", async (req, res, next) => {
  try {
    const { patient_id, shift_id } = req.query;
    if (!patient_id || !shift_id || typeof patient_id !== "string" || typeof shift_id !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "patient_id and shift_id required" } });
    }
    const notes = await NoteService.getForPatientShift(patient_id, shift_id);
    successResponse(res, notes);
  } catch (e) { next(e); }
});

// ─── Handover / Shift Summary ─────────────────────────────────────────────────
router.post("/shift-summary", async (req, res, next) => {
  try {
    const { shift_id, handoverNurseId } = req.body;
    if (!shift_id) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "shift_id required" } });
    }
    const [summary, stats] = await Promise.all([
      HandoverService.generateSummary(shift_id, handoverNurseId),
      HandoverService.getShiftStats(shift_id),
    ]);
    successResponse(res, { summaryText: summary, stats });
  } catch (e) { next(e); }
});

router.get("/shift-summary/:shift_id/stats", async (req, res, next) => {
  try {
    const stats = await HandoverService.getShiftStats(req.params.shift_id);
    successResponse(res, stats);
  } catch (e) { next(e); }
});

// ─── Dev utilities ────────────────────────────────────────────────────────────
router.post("/dev/generate-demo-data", async (req, res, next) => {
  try {
    const { shift_id } = req.body;
    if (!shift_id || typeof shift_id !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "shift_id required" } });
    }
    const result = await DemoService.generateDemoData(shift_id);
    successResponse(res, result, 201);
  } catch (e) { next(e); }
});

// ─── Health check ─────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
