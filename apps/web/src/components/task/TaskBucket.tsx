import { useState } from "react";
import { AlertTriangle, Clock, Timer, CalendarClock, CheckCircle2, TimerOff, Check, SkipForward, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn, BUCKET_CONFIG, TASK_TYPE_CONFIG, formatMinutesRelative, formatFrequency } from "../../lib/utils";
import { useSessionStore } from "../../stores/session.store";
import type { EnrichedTask, TaskLog, UrgencyBucket } from "../../types";

// ─── Bucket header icons ──────────────────────────────────────────────────────
const BUCKET_ICONS: Record<UrgencyBucket, React.ReactNode> = {
  OVERDUE:   <AlertTriangle size={13} />,
  DUE_NOW:   <Clock size={13} />,
  DUE_SOON:  <Timer size={13} />,
  LATER:     <CalendarClock size={13} />,
  COMPLETED: <CheckCircle2 size={13} />,
};

// ─── Per-row urgency icons ────────────────────────────────────────────────────
const ROW_URGENCY_ICONS: Record<UrgencyBucket, React.ReactNode> = {
  OVERDUE:   <TimerOff size={11} />,
  DUE_NOW:   <Clock size={11} />,
  DUE_SOON:  <Timer size={11} />,
  LATER:     <CalendarClock size={11} />,
  COMPLETED: <CheckCircle2 size={11} />,
};

// ─── Left border colors per bucket ───────────────────────────────────────────
const LEFT_BORDER: Record<UrgencyBucket, string> = {
  OVERDUE:   "border-l-rose-400",
  DUE_NOW:   "border-l-blue-400",
  DUE_SOON:  "border-l-amber-300",
  LATER:     "border-l-gray-200",
  COMPLETED: "border-l-green-400",
};

// ─── Bucket divider line colors ───────────────────────────────────────────────
const BUCKET_LINE_BG: Record<UrgencyBucket, string> = {
  OVERDUE:   "bg-rose-200",
  DUE_NOW:   "bg-blue-200",
  DUE_SOON:  "bg-amber-200",
  LATER:     "bg-gray-200",
  COMPLETED: "bg-green-200",
};

// ─── Single Task Row ──────────────────────────────────────────────────────────
interface TaskRowProps {
  task: EnrichedTask;
  onClick: (task: EnrichedTask) => void;
  onComplete?: (task: EnrichedTask) => void;
}

export function TaskRow({ task, onClick, onComplete }: TaskRowProps) {
  const { completingTaskIds } = useSessionStore();
  const isCompleting = completingTaskIds.includes(task.id);
  const bucketConfig = BUCKET_CONFIG[task.bucket];
  const typeConfig = TASK_TYPE_CONFIG[task.taskType];
  const isOverdue = task.bucket === "OVERDUE";

  return (
    <div
      className={cn(
        "flex items-center bg-white border-l-[3px] rounded-r-xl",
        "transition-all duration-150",
        isCompleting
          ? "opacity-40 pointer-events-none"
          : cn(
              "hover:shadow-md hover:-translate-y-px group",
              isOverdue ? "hover:bg-rose-50/50" : "hover:bg-gray-50/50"
            ),
        LEFT_BORDER[task.bucket]
      )}
    >
      {/* Clickable main area — flex-1 */}
      <button
        onClick={() => onClick(task)}
        className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left min-w-0"
        aria-label={`${task.title} for ${task.patient.name}`}
      >
        {/* Bed badge */}
        <div
          className={cn(
            "flex-shrink-0 w-14 rounded-lg px-2 py-2 text-center",
            isOverdue ? "bg-rose-50" : "bg-gray-50"
          )}
        >
          <p className="text-[10px] font-semibold text-gray-400 uppercase">BED</p>
          <p
            className={cn(
              "text-base font-bold",
              isOverdue ? "text-rose-500" : "text-gray-800"
            )}
          >
            {task.patient.bedNumber}
          </p>
        </div>

        {/* Patient + Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-gray-900 text-sm">{task.patient.name}</span>
            <span className="text-xs text-gray-400">
              {task.patient.gender}, {task.patient.age}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{typeConfig.icon}</span>
            <span className="text-sm text-gray-500 truncate">{task.title}</span>
            {task.frequencyMinutes && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                · every {formatFrequency(task.frequencyMinutes)}
              </span>
            )}
          </div>
          {task.missedIntervals > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle size={10} className="text-orange-500" />
              <span className="text-xs text-orange-600">
                {task.missedIntervals} missed interval{task.missedIntervals > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Due time indicator */}
        <div className="flex-shrink-0 text-right">
          <span className={cn("flex items-center gap-1 text-xs font-semibold", bucketConfig.textColor)}>
            {ROW_URGENCY_ICONS[task.bucket]}
            {formatMinutesRelative(task.minutesUntilDue)}
          </span>
          <p className="text-xs text-gray-400 mt-0.5">
            Scheduled: {format(new Date(task.nextDueTime), "HH:mm")}
          </p>
        </div>
      </button>

      {/* Quick-complete button — in-flow flex sibling, blue filled circle */}
      {onComplete && (
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task); }}
          className={cn(
            "flex-shrink-0 w-9 h-9 mr-3 rounded-full flex items-center justify-center",
            "transition-opacity duration-150 opacity-0 group-hover:opacity-100",
            "bg-blue-600 hover:bg-blue-700"
          )}
          title="Mark complete"
        >
          <Check size={14} className="text-white" />
        </button>
      )}
    </div>
  );
}

// ─── Completed Task Row (for Task History tab) ────────────────────────────────
interface CompletedTaskRowProps {
  log: TaskLog;
}

export function CompletedTaskRow({ log }: CompletedTaskRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-l-[3px] border-l-green-400 rounded-r-xl">
      <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {log.task?.title ?? "Task"}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {log.patient?.name ?? "—"} · Bed {log.patient?.bedNumber ?? "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-green-600 font-semibold">
          Completed {format(new Date(log.completedAt), "HH:mm")}
        </p>
        {log.nurse && (
          <p className="text-xs text-gray-400">by {log.nurse.name}</p>
        )}
      </div>
    </div>
  );
}

// ─── Skipped Task Row (for Task History tab) ──────────────────────────────────
export function SkippedTaskRow({ log }: { log: TaskLog }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-l-[3px] border-l-amber-400 rounded-r-xl">
      <SkipForward size={16} className="text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {log.task?.title ?? "Task"}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {log.patient?.name ?? "—"} · Bed {log.patient?.bedNumber ?? "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-amber-600 font-semibold">
          Skipped {format(new Date(log.completedAt), "HH:mm")}
        </p>
        {log.skipReason && (
          <p className="text-xs text-gray-400 truncate max-w-[120px]">{log.skipReason}</p>
        )}
      </div>
    </div>
  );
}

// ─── Missed Task Row (auto-missed — for Task History tab) ────────────────────
export function MissedTaskRow({ log }: { log: TaskLog }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-l-[3px] border-l-rose-300 rounded-r-xl">
      <TimerOff size={16} className="text-rose-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {log.task?.title ?? "Task"}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {log.patient?.name ?? "—"} · Bed {log.patient?.bedNumber ?? "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-rose-500 font-semibold">
          Missed {format(new Date(log.completedAt), "HH:mm")}
        </p>
        <p className="text-xs text-gray-400">Auto-missed</p>
      </div>
    </div>
  );
}

// ─── Bucket Section ───────────────────────────────────────────────────────────
interface TaskBucketProps {
  bucket: UrgencyBucket;
  tasks: EnrichedTask[];
  onTaskClick: (task: EnrichedTask) => void;
  onComplete?: (task: EnrichedTask) => void;
  defaultCollapsed?: boolean;
}

export function TaskBucket({ bucket, tasks, onTaskClick, onComplete, defaultCollapsed }: TaskBucketProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const { completingTaskIds } = useSessionStore();
  const displayCount = tasks.filter((t) => !completingTaskIds.includes(t.id)).length;

  if (tasks.length === 0) return null;

  const config = BUCKET_CONFIG[bucket];

  return (
    <div className="mb-5">
      {/* Bucket Header with extending colored divider line */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 mb-2 px-1"
      >
        <span className={config.textColor}>{BUCKET_ICONS[bucket]}</span>
        <h3 className={cn("text-xs font-bold uppercase tracking-widest whitespace-nowrap", config.textColor)}>
          {config.label} ({displayCount})
        </h3>
        <div className={cn("flex-1 h-px ml-1", BUCKET_LINE_BG[bucket])} />
        <ChevronDown
          size={13}
          className={cn(
            "flex-shrink-0 ml-1 transition-transform duration-200",
            config.textColor,
            isOpen ? "" : "-rotate-90"
          )}
        />
      </button>

      {/* Task Rows */}
      {isOpen && (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <TaskRow
              key={`${task.id}-${task.nextDueTime}`}
              task={task}
              onClick={onTaskClick}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
