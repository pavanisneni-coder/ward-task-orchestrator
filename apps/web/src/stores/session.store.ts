import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Nurse, Shift, UndoState } from "../types";

interface SessionStore {
  currentNurse: Nurse | null;
  currentShift: Shift | null;
  viewMode: "MY_TASKS" | "WARD_OVERVIEW";
  undoStates: UndoState[];
  completingTaskIds: string[];
  lastActivity: number;

  setNurse: (nurse: Nurse) => void;
  setShift: (shift: Shift) => void;
  setViewMode: (mode: "MY_TASKS" | "WARD_OVERVIEW") => void;
  addUndoState: (state: UndoState) => void;
  removeUndoState: (logId: string) => void;
  addCompletingTask: (taskId: string) => void;
  removeCompletingTask: (taskId: string) => void;
  clearSession: () => void;
  touchActivity: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      currentNurse: null,
      currentShift: null,
      viewMode: "MY_TASKS",
      undoStates: [],
      completingTaskIds: [],
      lastActivity: Date.now(),

      setNurse: (nurse) => set({ currentNurse: nurse, lastActivity: Date.now() }),
      setShift: (shift) => set({ currentShift: shift, lastActivity: Date.now() }),
      setViewMode: (mode) => set({ viewMode: mode }),
      addUndoState: (state) =>
        set((s) => ({
          undoStates: [...s.undoStates.filter((u) => u.logId !== state.logId), state],
        })),
      removeUndoState: (logId) =>
        set((s) => ({ undoStates: s.undoStates.filter((u) => u.logId !== logId) })),
      addCompletingTask: (taskId) =>
        set((s) => ({
          completingTaskIds: s.completingTaskIds.includes(taskId)
            ? s.completingTaskIds
            : [...s.completingTaskIds, taskId],
        })),
      removeCompletingTask: (taskId) =>
        set((s) => ({
          completingTaskIds: s.completingTaskIds.filter((id) => id !== taskId),
        })),
      clearSession: () =>
        set({ currentNurse: null, currentShift: null, undoStates: [], completingTaskIds: [] }),
      touchActivity: () => set({ lastActivity: Date.now() }),
    }),
    {
      name: "ward-session",
      partialize: (state) => ({
        currentNurse: state.currentNurse,
        currentShift: state.currentShift,
        viewMode: state.viewMode,
        lastActivity: state.lastActivity,
      }),
    }
  )
);
