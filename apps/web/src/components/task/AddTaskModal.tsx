import { useState } from "react";
import { format } from "date-fns";
import { Modal, Button } from "../ui";
import { useCreateTask } from "../../hooks/queries";
import { useSessionStore } from "../../stores/session.store";
import { TASK_TYPE_CONFIG, cn } from "../../lib/utils";
import type { TaskType } from "../../types";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

const TASK_PROTOCOLS: Array<{ id: TaskType; label: string; defaultFreq: number | null }> = [
  { id: "MEDICATION", label: "Medication Administration", defaultFreq: 360 },
  { id: "MONITORING", label: "Vitals / Monitoring", defaultFreq: 120 },
  { id: "CARE_PROCEDURE", label: "Care Procedure", defaultFreq: null },
  { id: "ONE_TIME", label: "One-Time Task", defaultFreq: null },
];

export function AddTaskModal({ open, onClose, patientId, patientName }: AddTaskModalProps) {
  const { currentNurse } = useSessionStore();
  const createTask = useCreateTask();

  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [customTitle, setCustomTitle] = useState("");
  const [frequencyMinutes, setFrequencyMinutes] = useState(60);
  const [freqUnit, setFreqUnit] = useState<"hrs" | "min">("hrs");
  const [anchorDay, setAnchorDay] = useState<"TODAY" | "TOMORROW">("TODAY");
  const [anchorTime, setAnchorTime] = useState(() => format(new Date(), "HH:mm"));
  const [isRecurring, setIsRecurring] = useState(true);

  const handleTaskTypeChange = (type: TaskType) => {
    setTaskType(type);
    const proto = TASK_PROTOCOLS.find((p) => p.id === type);
    if (proto?.defaultFreq) {
      setFrequencyMinutes(proto.defaultFreq);
      setFreqUnit(proto.defaultFreq >= 60 ? "hrs" : "min");
      setIsRecurring(true);
    } else {
      setIsRecurring(false);
    }
  };

  const handleSave = async () => {
    if (!taskType) return;

    const [h, m] = anchorTime.split(":").map(Number);
    const anchor = new Date();
    if (anchorDay === "TOMORROW") anchor.setDate(anchor.getDate() + 1);
    anchor.setHours(h, m, 0, 0);

    await createTask.mutateAsync({
      patientId,
      taskType,
      title: customTitle || TASK_PROTOCOLS.find((p) => p.id === taskType)?.label || taskType,
      frequencyMinutes: isRecurring ? frequencyMinutes : null,
      anchorTime: anchor.toISOString(),
      // graceMinutes omitted — API applies DEFAULT_GRACE[taskType]
    });

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setTaskType("");
    setCustomTitle("");
    setFrequencyMinutes(60);
    setFreqUnit("hrs");
    setAnchorDay("TODAY");
    setAnchorTime(format(new Date(), "HH:mm"));
    setIsRecurring(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div>
          <h2 className="text-xl font-bold text-gray-900">Add New Task</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            For: <span className="text-gray-600 font-medium">{patientName}</span>
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Task Protocol */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Task Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TASK_PROTOCOLS.map((proto) => {
              const config = TASK_TYPE_CONFIG[proto.id];
              return (
                <button
                  key={proto.id}
                  onClick={() => handleTaskTypeChange(proto.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all",
                    taskType === proto.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span>{config.icon}</span>
                  <span className="text-xs leading-tight">{proto.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom title */}
        {taskType && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Task Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={TASK_PROTOCOLS.find((p) => p.id === taskType)?.label}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Recurring toggle */}
        {taskType && taskType !== "ONE_TIME" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full transition-colors",
                isRecurring ? "bg-blue-600" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5",
                  isRecurring ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
            <span className="text-sm text-gray-700 font-medium">Recurring task</span>
          </div>
        )}

        {/* Frequency */}
        {isRecurring && taskType && taskType !== "ONE_TIME" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Frequency
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={freqUnit === "min" ? 60 : undefined}
                value={freqUnit === "hrs" ? Math.max(1, Math.round(frequencyMinutes / 60)) : frequencyMinutes}
                onChange={(e) => {
                  const n = Math.max(1, parseInt(e.target.value) || 1);
                  if (freqUnit === "hrs") {
                    setFrequencyMinutes(n * 60);
                  } else {
                    setFrequencyMinutes(Math.min(60, n));
                  }
                }}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => {
                    setFreqUnit("hrs");
                    setFrequencyMinutes((prev) => Math.max(60, Math.round(prev / 60) * 60));
                  }}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium transition-colors",
                    freqUnit === "hrs" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  hrs
                </button>
                <button
                  onClick={() => {
                    setFreqUnit("min");
                    setFrequencyMinutes((prev) => Math.min(60, prev));
                  }}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium transition-colors border-l border-gray-200",
                    freqUnit === "min" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  min
                </button>
              </div>
              {freqUnit === "min" && (
                <span className="text-xs text-gray-400">max 60</span>
              )}
            </div>
          </div>
        )}

        {/* Anchor Time */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {isRecurring ? "Start Time" : "Scheduled Time"}
          </label>
          <div className="flex gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setAnchorDay("TODAY")}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors",
                  anchorDay === "TODAY" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                Today
              </button>
              <button
                onClick={() => setAnchorDay("TOMORROW")}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-200",
                  anchorDay === "TOMORROW" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                Tomorrow
              </button>
            </div>
            <input
              type="time"
              value={anchorTime}
              onChange={(e) => setAnchorTime(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={!taskType}
            loading={createTask.isPending}
          >
            ✓ Save Task
          </Button>
        </div>
      </div>
    </Modal>
  );
}
