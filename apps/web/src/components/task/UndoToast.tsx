import { useEffect, useState, useCallback } from "react";
import { CheckCircle, SkipForward } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/session.store";
import { useUndoTask } from "../../hooks/queries";
import { QK } from "../../hooks/queries";
import { cn } from "../../lib/utils";
import type { UndoState } from "../../types";

function SingleUndoToast({ state }: { state: UndoState }) {
  const qc = useQueryClient();
  const { removeUndoState, removeCompletingTask, currentShift } = useSessionStore();
  const undoTask = useUndoTask();
  const [timeLeft, setTimeLeft] = useState(15);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      const secondsLeft = Math.ceil((state.expiresAt - Date.now()) / 1000);
      setTimeLeft(Math.max(0, secondsLeft));
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setVisible(false);
        setTimeout(async () => {
          removeUndoState(state.logId);
          if (currentShift) {
            await Promise.all([
              qc.refetchQueries({ queryKey: ["tasks", currentShift.id] }),
              qc.refetchQueries({ queryKey: QK.taskLogs(currentShift.id) }),
            ]);
          }
          removeCompletingTask(state.taskId);
        }, 300);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state.expiresAt, state.logId, state.taskId, state.type, removeUndoState, removeCompletingTask, currentShift, qc]);

  const handleUndo = useCallback(async () => {
    await undoTask.mutateAsync({ logId: state.logId, taskId: state.taskId });
  }, [state.logId, state.taskId, undoTask]);

  const isSkip = state.type === "skip";
  const progress = (timeLeft / 15) * 100;

  return (
    <div
      className={cn(
        "bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden",
        "min-w-[300px] max-w-xs transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-700">
        <div
          className={cn(
            "h-0.5 transition-all duration-200",
            isSkip ? "bg-amber-400" : "bg-green-400"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-4 py-3 flex items-center gap-3">
        {isSkip
          ? <SkipForward size={16} className="text-amber-400 flex-shrink-0" />
          : <CheckCircle size={16} className="text-green-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isSkip ? "Task skipped" : "Task marked complete"}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {state.taskTitle} · {state.patientName}
          </p>
        </div>
        <button
          onClick={handleUndo}
          disabled={undoTask.isPending}
          className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex-shrink-0 transition-colors disabled:opacity-50"
        >
          {undoTask.isPending ? "..." : "UNDO"}
        </button>
      </div>
    </div>
  );
}

export function UndoToast() {
  const { undoStates } = useSessionStore();
  if (undoStates.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col-reverse gap-2 items-start">
      {undoStates.map((state) => (
        <SingleUndoToast key={state.logId} state={state} />
      ))}
    </div>
  );
}
