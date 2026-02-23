import { useState } from "react";
import { AlertCircle, Clock, Pill, Activity, Clipboard, FileText } from "lucide-react";
import { Modal, Button, Badge } from "../ui";
import { useCompleteTask, useSkipTask } from "../../hooks/queries";
import { useSessionStore } from "../../stores/session.store";
import { formatMinutesRelative, TASK_TYPE_CONFIG, cn } from "../../lib/utils";
import { format } from "date-fns";
import type { EnrichedTask } from "../../types";

interface TaskInteractionModalProps {
  task: EnrichedTask | null;
  onClose: () => void;
}

const SKIP_REASONS = ["Patient refused", "Doctor held dose", "NPO status", "Medication unavailable", "Patient away from bed"];

const TASK_ICONS = {
  MEDICATION: Pill,
  MONITORING: Activity,
  CARE_PROCEDURE: Clipboard,
  ONE_TIME: FileText,
};

export function TaskInteractionModal({ task, onClose }: TaskInteractionModalProps) {
  const { currentNurse, currentShift } = useSessionStore();
  const completeTask = useCompleteTask();
  const skipTask = useSkipTask();

  const [skipReason, setSkipReason] = useState("");
  const [showSkipForm, setShowSkipForm] = useState(false);

  if (!task) return null;

  const isOverdue = task.bucket === "OVERDUE";
  const typeConfig = TASK_TYPE_CONFIG[task.taskType];
  const TaskIcon = TASK_ICONS[task.taskType];

  const handleComplete = async () => {
    if (!currentNurse || !currentShift) return;
    await completeTask.mutateAsync({ task, nurseId: currentNurse.id });
    onClose();
  };

  const handleSkip = async () => {
    if (!currentNurse || !currentShift || !skipReason.trim()) return;
    await skipTask.mutateAsync({
      taskId: task.id,
      nurseId: currentNurse.id,
      reason: skipReason,
      taskTitle: task.title,
      patientName: task.patient.name,
    });
    onClose();
    setShowSkipForm(false);
    setSkipReason("");
  };

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
              isOverdue ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-500"
            )}
          >
            <AlertCircle size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Task Action Required</h2>
            <p className="text-sm text-gray-400">
              Patient:{" "}
              <span className="text-gray-700 font-medium">{task.patient.name}</span>{" "}
              <span className="text-gray-400">(Bed {task.patient.bedNumber})</span>
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Task Card */}
        <div
          className={cn(
            "rounded-xl p-4 border",
            isOverdue ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
          )}
        >
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Assigned Task
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className={cn("text-base p-1 rounded", typeConfig.color)}>
                {typeConfig.icon}
              </span>
              <div>
                <p className="font-bold text-gray-900">{task.title}</p>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", typeConfig.color)}>
                    {typeConfig.label}
                  </span>
                  <span>• Room {task.patient.bedNumber}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock size={13} className={isOverdue ? "text-red-500" : "text-blue-500"} />
              <span
                className={cn(
                  "text-xs font-semibold",
                  isOverdue ? "text-red-600" : "text-blue-600"
                )}
              >
                {isOverdue ? "Overdue" : "Due"}: {format(new Date(task.nextDueTime), "HH:mm")}
                {isOverdue && ` (${Math.abs(task.minutesUntilDue)}m overdue)`}
              </span>
            </div>
          </div>
          {task.missedIntervals > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
              <AlertCircle size={12} />
              <span>{task.missedIntervals} interval{task.missedIntervals > 1 ? "s" : ""} missed</span>
            </div>
          )}
        </div>

        {/* Last completed info */}
        {task.lastLog && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Last done:</span>
            <span className="text-gray-600">
              {format(new Date(task.lastLog.completedAt), "HH:mm")} by {task.lastLog.nurse.name}
            </span>
          </div>
        )}

        {/* Skip Form */}
        {showSkipForm && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <FileText size={14} />
              Reason for skipping
            </div>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Select or type a reason for skipping this task..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-2">
              {SKIP_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSkipReason(reason)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    skipReason === reason
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!showSkipForm ? (
            <>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setShowSkipForm(true)}
              >
                ▶ Skip
              </Button>
              <Button
                variant="primary"
                className="flex-1 gap-2"
                onClick={handleComplete}
                loading={completeTask.isPending}
              >
                ✓ Mark Complete
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowSkipForm(false)}>
                Back
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleSkip}
                disabled={!skipReason.trim()}
                loading={skipTask.isPending}
              >
                Confirm Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
