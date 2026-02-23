import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSessionStore } from "../stores/session.store";
import type { EnrichedTask } from "../types";

// Query Keys
export const QK = {
  nurses: ["nurses"] as const,
  patients: ["patients"] as const,
  shift: (nurseId: string) => ["shift", nurseId] as const,
  assignments: (shiftId: string) => ["assignments", shiftId] as const,
  tasks: (shiftId: string, nurseId?: string) => ["tasks", shiftId, nurseId] as const,
  taskLogs: (shiftId: string) => ["task-logs", shiftId] as const,
  notes: (patientId: string, shiftId: string) => ["notes", patientId, shiftId] as const,
  handover: (shiftId: string) => ["handover", shiftId] as const,
};

// ─── Nurses ───────────────────────────────────────────────────────────────────
export function useNurses() {
  return useQuery({
    queryKey: QK.nurses,
    queryFn: () => api.nurses.list(),
    staleTime: 10 * 60 * 1000, // 10 min - nurse list rarely changes
  });
}

// ─── Patients ─────────────────────────────────────────────────────────────────
export function usePatients() {
  return useQuery({
    queryKey: QK.patients,
    queryFn: () => api.patients.list(),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// ─── Shift ────────────────────────────────────────────────────────────────────
export function useActiveShift(nurseId: string | undefined) {
  return useQuery({
    queryKey: QK.shift(nurseId ?? ""),
    queryFn: () => api.shifts.getActive(nurseId!),
    enabled: !!nurseId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Assignments ──────────────────────────────────────────────────────────────
export function useAssignments(shiftId: string | undefined) {
  return useQuery({
    queryKey: QK.assignments(shiftId ?? ""),
    queryFn: () => api.assignments.getForShift(shiftId!),
    enabled: !!shiftId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Tasks - auto-refetch every 30s (live urgency updates) ───────────────────
export function useTasks(shiftId: string | undefined, nurseId?: string) {
  return useQuery({
    queryKey: QK.tasks(shiftId ?? "", nurseId),
    queryFn: () => api.tasks.getForShift(shiftId!, nurseId),
    enabled: !!shiftId,
    refetchInterval: false,
    staleTime: 20 * 1000,
  });
}

// ─── Complete Task ────────────────────────────────────────────────────────────
export function useCompleteTask() {
  const qc = useQueryClient();
  const { currentShift, currentNurse, viewMode, addUndoState, addCompletingTask, removeCompletingTask } = useSessionStore();

  return useMutation({
    mutationFn: (vars: { task: EnrichedTask; nurseId: string }) =>
      api.taskLogs.complete({
        taskId: vars.task.id,
        nurseId: vars.nurseId,
        shiftId: currentShift!.id,
      }),
    onMutate: async ({ task }) => {
      // Grey the row immediately — prevents double-tap from firing a second mutation
      addCompletingTask(task.id);
      // Cancel any in-flight refetches so the row stays in place
      await qc.cancelQueries({ queryKey: ["tasks", currentShift?.id ?? ""] });
      // Derive the exact query key the Dashboard is using so the snapshot matches
      const isHeadNurse = currentNurse?.role === "Head Nurse";
      const nurseFilter = (!isHeadNurse || viewMode === "MY_TASKS") ? currentNurse?.id : undefined;
      const snapshotKey = QK.tasks(currentShift?.id ?? "", nurseFilter);
      const previousTasks = qc.getQueryData<EnrichedTask[]>(snapshotKey);
      return { previousTasks, snapshotKey };
    },
    onSuccess: (log, { task }) => {
      // Add undo state — deferred invalidation happens in UndoToast on expiry
      addUndoState({
        logId: log.id,
        taskId: task.id,
        taskTitle: task.title,
        patientName: task.patient.name,
        expiresAt: Date.now() + 15000,
        type: "complete",
      });
      // No invalidateQueries here — the task moves to history after the undo window expires
    },
    onError: (_err, vars, ctx) => {
      removeCompletingTask(vars.task.id);
      if (ctx?.previousTasks && ctx?.snapshotKey && currentShift) {
        qc.setQueryData(ctx.snapshotKey, ctx.previousTasks);
      }
    },
  });
}

// ─── Skip Task ────────────────────────────────────────────────────────────────
export function useSkipTask() {
  const { currentShift, addUndoState, addCompletingTask, removeCompletingTask } = useSessionStore();

  return useMutation({
    mutationFn: (vars: {
      taskId: string;
      nurseId: string;
      reason: string;
      taskTitle: string;
      patientName: string;
    }) =>
      api.taskLogs.skip({
        taskId: vars.taskId,
        nurseId: vars.nurseId,
        shiftId: currentShift!.id,
        reason: vars.reason,
      }),
    onMutate: ({ taskId }) => {
      addCompletingTask(taskId); // grey the row immediately before API returns
    },
    onSuccess: (log, vars) => {
      addUndoState({
        logId: log.id,
        taskId: vars.taskId,
        taskTitle: vars.taskTitle,
        patientName: vars.patientName,
        expiresAt: Date.now() + 15000,
        type: "skip",
      });
      // No invalidateQueries — deferred to UndoToast expiry or undo
    },
    onError: (_err, vars) => {
      removeCompletingTask(vars.taskId);
    },
  });
}

// ─── Undo ─────────────────────────────────────────────────────────────────────
export function useUndoTask() {
  const qc = useQueryClient();
  const { currentShift, removeUndoState, removeCompletingTask } = useSessionStore();

  return useMutation({
    mutationFn: ({ logId }: { logId: string; taskId: string }) => api.taskLogs.undo(logId),
    onSuccess: (_, { logId, taskId }) => {
      removeUndoState(logId);
      removeCompletingTask(taskId);
      if (currentShift) {
        qc.invalidateQueries({ queryKey: ["tasks", currentShift.id] });
        qc.invalidateQueries({ queryKey: QK.taskLogs(currentShift.id) });
      }
    },
    onError: (_, { logId, taskId }) => {
      removeUndoState(logId);
      removeCompletingTask(taskId);
    },
  });
}

// ─── Create Task ──────────────────────────────────────────────────────────────
export function useCreateTask() {
  const qc = useQueryClient();
  const { currentShift } = useSessionStore();

  return useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => {
      if (currentShift) {
        qc.invalidateQueries({ queryKey: ["tasks", currentShift.id] });
      }
    },
  });
}

// ─── Add Note ─────────────────────────────────────────────────────────────────
export function useAddNote() {
  const qc = useQueryClient();
  const { currentShift } = useSessionStore();

  return useMutation({
    mutationFn: api.notes.create,
    onSuccess: (_note, vars) => {
      if (currentShift) {
        qc.invalidateQueries({ queryKey: QK.notes(vars.patientId, currentShift.id) });
        qc.invalidateQueries({ queryKey: QK.tasks(currentShift.id) });
        qc.invalidateQueries({ queryKey: QK.assignments(currentShift.id) });
      }
    },
  });
}

// ─── Task Logs ────────────────────────────────────────────────────────────────
export function useTaskLogs(shiftId: string | undefined) {
  const { undoStates } = useSessionStore();
  return useQuery({
    queryKey: QK.taskLogs(shiftId ?? ""),
    queryFn: () => api.taskLogs.getForShift(shiftId!),
    enabled: !!shiftId,
    staleTime: 10 * 1000,
    refetchInterval: undoStates.length > 0 ? false : 30 * 1000,
  });
}

// ─── Handover ─────────────────────────────────────────────────────────────────
export function useHandover(shiftId: string | undefined) {
  return useQuery({
    queryKey: QK.handover(shiftId ?? ""),
    queryFn: () => api.handover.generate(shiftId!),
    enabled: false, // Manual trigger only
    retry: 1,
  });
}

export function useGenerateHandover() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ shiftId, handoverNurseId }: { shiftId: string; handoverNurseId?: string }) =>
      api.handover.generate(shiftId, handoverNurseId),
    onSuccess: (data, { shiftId }) => {
      qc.setQueryData(QK.handover(shiftId), data);
    },
  });
}

// ─── Generate Demo Data (dev only) ────────────────────────────────────────────
export function useGenerateDemoData() {
  const queryClient = useQueryClient();
  const { currentShift } = useSessionStore();

  return useMutation({
    mutationFn: () => api.dev.generateDemoData(currentShift!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.tasks(currentShift!.id) });
      queryClient.invalidateQueries({ queryKey: QK.taskLogs(currentShift!.id) });
    },
  });
}
