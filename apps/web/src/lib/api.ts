import type {
  Nurse, Shift, NurseAssignment, EnrichedTask,
  TaskLog, Note, HandoverSummary, Task, TaskType, PatientWithNurse,
} from "../types";

const BASE =
  import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const json = await res.json();

  if (!res.ok) {
    const message = json?.error?.message ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return json.data as T;
}

// ─── Nurses ───────────────────────────────────────────────────────────────────
export const api = {
  nurses: {
    list: () => request<Nurse[]>("/nurses"),
    get: (id: string) => request<Nurse>(`/nurses/${id}`),
  },

  shifts: {
    getActive: (nurseId: string) =>
      request<Shift>(`/shifts/active?nurse_id=${nurseId}`),
    archive: (shiftId: string) =>
      request<Shift>(`/shifts/${shiftId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      }),
  },

  assignments: {
    getForShift: (shiftId: string) =>
      request<NurseAssignment[]>(`/assignments?shift_id=${shiftId}`),
    assign: (data: { nurseId: string; patientId: string; shiftId: string }) =>
      request<NurseAssignment>("/assignments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      fetch(`${BASE}/assignments/${id}`, { method: "DELETE" }),
  },

  tasks: {
    getForShift: (shiftId: string, nurseId?: string) => {
      const params = new URLSearchParams({ shift_id: shiftId });
      if (nurseId) params.append("nurse_id", nurseId);
      return request<EnrichedTask[]>(`/tasks?${params}`);
    },
    getForPatient: (patientId: string) =>
      request<Task[]>(`/tasks?patient_id=${patientId}`),
    create: (data: {
      patientId: string;
      taskType: TaskType;
      title: string;
      frequencyMinutes?: number | null;
      anchorTime: string;
      graceMinutes?: number;
      lookaheadMinutes?: number;
    }) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
    discontinue: (taskId: string) =>
      request<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "discontinue" }),
      }),
  },

  taskLogs: {
    complete: (data: { taskId: string; nurseId: string; shiftId: string }) =>
      request<TaskLog>("/task-log", {
        method: "POST",
        body: JSON.stringify({ ...data, action: "complete" }),
      }),
    skip: (data: {
      taskId: string;
      nurseId: string;
      shiftId: string;
      reason: string;
    }) =>
      request<TaskLog>("/task-log", {
        method: "POST",
        body: JSON.stringify({ ...data, action: "skip" }),
      }),
    undo: (logId: string) =>
      request<{ success: boolean }>(`/task-log/${logId}/undo`, { method: "DELETE" }),
    getForShift: (shiftId: string) =>
      request<TaskLog[]>(`/task-log?shift_id=${shiftId}`),
  },

  notes: {
    create: (data: {
      patientId: string;
      nurseId: string;
      shiftId: string;
      content: string;
    }) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    getForPatientShift: (patientId: string, shiftId: string) =>
      request<Note[]>(`/notes?patient_id=${patientId}&shift_id=${shiftId}`),
  },

  patients: {
    list: () => request<PatientWithNurse[]>("/patients"),
  },

  handover: {
    generate: (shiftId: string, handoverNurseId?: string) =>
      request<HandoverSummary>("/shift-summary", {
        method: "POST",
        body: JSON.stringify({ shift_id: shiftId, handoverNurseId }),
      }),
    getStats: (shiftId: string) =>
      request<HandoverSummary["stats"]>(`/shift-summary/${shiftId}/stats`),
  },

  dev: {
    generateDemoData: (shiftId: string) =>
      request<{ tasksCreated: number }>("/dev/generate-demo-data", {
        method: "POST",
        body: JSON.stringify({ shift_id: shiftId }),
      }),
  },
};
