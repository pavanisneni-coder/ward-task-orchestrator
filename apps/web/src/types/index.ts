export type TaskType = "MEDICATION" | "MONITORING" | "CARE_PROCEDURE" | "ONE_TIME";
export type UrgencyBucket = "OVERDUE" | "DUE_NOW" | "DUE_SOON" | "LATER" | "COMPLETED";
export type PatientStatus = "STABLE" | "OBSERVATION" | "POST_OP" | "DISCHARGE";

export interface Nurse {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  hasActiveShift?: boolean;
  patientCount?: number;
}

export interface PatientWithNurse extends Patient {
  assignments: Array<{
    id: string;
    nurseId: string;
    patientId: string;
    shiftId: string;
    nurse: { id: string; name: string; role: string };
  }>;
}

export interface Patient {
  id: string;
  name: string;
  bedNumber: string;
  age: number | null;
  gender: string | null;
  diagnosis: string | null;
  status: PatientStatus;
}

export interface Task {
  id: string;
  patientId: string;
  taskType: TaskType;
  title: string;
  frequencyMinutes: number | null;
  anchorTime: string;
  graceMinutes: number;
  lookaheadMinutes: number;
  isActive: boolean;
}

export interface EnrichedTask extends Task {
  patient: Pick<Patient, "id" | "name" | "bedNumber" | "age" | "gender" | "status">;
  bucket: UrgencyBucket;
  nextDueTime: string;
  minutesUntilDue: number;
  missedIntervals: number;
  lastLog: {
    completedAt: string;
    wasSkipped: boolean;
    skipReason: string | null;
    nurse: { name: string };
  } | null;
}

export interface Shift {
  id: string;
  nurseId: string;
  startTime: string;
  endTime: string;
  archived: boolean;
}

export interface TaskLog {
  id: string;
  taskId: string;
  nurseId: string;
  shiftId: string;
  patientId: string;
  completedAt: string;
  wasOverdue: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  nurse?: { id: string; name: string };
  task?: { id: string; title: string; taskType: TaskType };
  patient?: { id: string; name: string; bedNumber: string };
}

export interface Note {
  id: string;
  patientId: string;
  nurseId: string;
  shiftId: string;
  content: string;
  timestamp: string;
  nurse?: { id: string; name: string };
}

export interface NurseAssignment {
  id: string;
  nurseId: string;
  patientId: string;
  shiftId: string;
  patient: Patient & {
    tasks: Task[];
    notes: Note[];
  };
}

export interface ShiftStats {
  logs: TaskLog[];
  notes: Note[];
  assignments: NurseAssignment[];
  stats: {
    completed: number;
    skipped: number;
    overdue: number;
    patientCount: number;
  };
}

export interface HandoverSummary {
  summaryText: string;
  stats: ShiftStats;
}

// UI-only types
export interface UndoState {
  logId: string;
  taskId: string;
  taskTitle: string;
  patientName: string;
  expiresAt: number;
  type: "complete" | "skip";
}
