import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { LogOut, ClipboardList, Filter, Search, Plus, ChevronDown } from "lucide-react";
import { useTasks, useCompleteTask, useTaskLogs, useAssignments } from "../hooks/queries";
import { useSessionStore } from "../stores/session.store";
import { TaskBucket, CompletedTaskRow, SkippedTaskRow, MissedTaskRow } from "../components/task/TaskBucket";
import { TaskInteractionModal } from "../components/task/TaskInteractionModal";
import { CensusCards } from "../components/patient/CensusCards";
import { UndoToast } from "../components/task/UndoToast";
import { Spinner, EmptyState } from "../components/ui";
import { cn, formatShiftTime, getRoleLabel, getNurseAvatar } from "../lib/utils";
import type { EnrichedTask, UrgencyBucket } from "../types";

const BUCKETS: UrgencyBucket[] = ["OVERDUE", "DUE_NOW", "DUE_SOON", "LATER"];


export function Dashboard() {
  const navigate = useNavigate();
  const { currentNurse, currentShift, viewMode, setViewMode, clearSession, completingTaskIds } = useSessionStore();
  const [selectedTask, setSelectedTask] = useState<EnrichedTask | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [taskTab, setTaskTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [completedOpen, setCompletedOpen] = useState(true);
  const [skippedOpen, setSkippedOpen] = useState(true);
  const [missedOpen, setMissedOpen] = useState(true);

  // Redirect if no session
  useEffect(() => {
    if (!currentNurse || !currentShift) navigate("/");
  }, [currentNurse, currentShift, navigate]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-lock after 5 minutes inactivity
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const { lastActivity } = useSessionStore.getState();
      if (Date.now() - lastActivity > 5 * 60 * 1000) {
        clearSession();
        navigate("/");
      }
    }, 30 * 1000);
    return () => clearInterval(checkInactivity);
  }, [clearSession, navigate]);

  const isHeadNurse = currentNurse?.role === "Head Nurse";
  const nurseFilter = (!isHeadNurse || viewMode === "MY_TASKS") ? currentNurse?.id : undefined;
  const { data: tasks, isLoading, error } = useTasks(currentShift?.id, nurseFilter);
  const { data: taskLogs } = useTaskLogs(currentShift?.id);
  const { data: assignments = [] } = useAssignments(currentShift?.id);
  const completeTask = useCompleteTask();

  if (!currentNurse || !currentShift) return null;

  const filteredTasks = (tasks ?? []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.patient.name.toLowerCase().includes(q) ||
      t.patient.bedNumber.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q)
    );
  });

  const LATER_HORIZON_MINUTES = 12 * 60;

  const tasksByBucket = BUCKETS.reduce((acc, bucket) => {
    acc[bucket] = filteredTasks.filter((t) => {
      if (t.bucket !== bucket) return false;
      if (bucket === "LATER") return t.minutesUntilDue <= LATER_HORIZON_MINUTES;
      return true;
    });
    return acc;
  }, {} as Record<UrgencyBucket, EnrichedTask[]>);

  const URGENT_BUCKETS: UrgencyBucket[] = ["OVERDUE", "DUE_NOW", "DUE_SOON"];
  // Use a Set to deduplicate task IDs — two-instance cards share the same id
  // across OVERDUE and DUE_SOON buckets, so a plain sum would double-count them.
  const activeTaskIdSet = new Set<string>();
  URGENT_BUCKETS.forEach((b) => {
    tasksByBucket[b].forEach((t) => {
      if (!completingTaskIds.includes(t.id)) activeTaskIdSet.add(t.id);
    });
  });
  const activeCount = activeTaskIdSet.size;

  const completedLogs = taskLogs?.filter((l) => !l.wasSkipped) ?? [];
  const missedLogs    = taskLogs?.filter((l) => l.wasSkipped && l.skipReason === "auto-missed") ?? [];
  const skippedLogs   = taskLogs?.filter((l) => l.wasSkipped && l.skipReason !== "auto-missed") ?? [];

  const handleComplete = (task: EnrichedTask) => {
    completeTask.mutate({ task, nurseId: currentNurse.id });
  };

  return (
    <div
      className="h-screen bg-[#F8FAFC] flex flex-col overflow-hidden"
      onClick={() => useSessionStore.getState().touchActivity()}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus size={18} className="text-white" strokeWidth={2.5} />
          </div>

          {/* Ward name */}
          <span className="font-bold text-gray-900 text-sm">Ward 3B Orchestrator</span>

          {/* Nav tabs */}
          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {(["Dashboard", "Patients", "Staff", "Handover"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === "Handover") navigate("/handover");
                  else if (tab === "Patients") navigate("/patients");
                  else if (tab === "Staff") navigate("/staff");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  tab === "Dashboard"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Shift info */}
          <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 mr-2">
            <span className="font-semibold text-gray-600">CURRENT SHIFT</span>
            <span>{formatShiftTime(currentShift.startTime, currentShift.endTime)}</span>
          </div>

          {/* Code Blue — inactive */}
          <button disabled className="flex items-center gap-1.5 bg-gray-200 text-gray-400 text-xs font-bold px-3 py-2 rounded-lg cursor-not-allowed">
            ✚ Code Blue
          </button>

          {/* Nurse info */}
          <div className="flex items-center gap-2 ml-1">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
              <img
                src={getNurseAvatar(currentNurse.name, currentNurse.avatarUrl)}
                alt={currentNurse.name}
                className="w-full h-full object-cover object-center block"
              />
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-gray-800">{currentNurse.name}</p>
              <p className="text-xs text-gray-400">{getRoleLabel(currentNurse.role)}</p>
            </div>
            <button
              onClick={() => { clearSession(); navigate("/"); }}
              className="ml-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content — task list scrolls, census pinned at bottom */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Task Orchestrator panel */}
        <div className="flex-1 overflow-hidden flex flex-col max-w-6xl w-full mx-auto">
          {/* Section Header row — fixed */}
          <div className="px-4 pt-5 pb-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              <h1 className="font-bold text-gray-900">Task Orchestrator</h1>
            </div>

            {/* View toggle — Head Nurse only */}
            {isHeadNurse && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setViewMode("MY_TASKS")}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-all",
                    viewMode === "MY_TASKS"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  My Tasks
                </button>
                <button
                  onClick={() => setViewMode("WARD_OVERVIEW")}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-all",
                    viewMode === "WARD_OVERVIEW"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Ward Overview
                </button>
              </div>
            )}
          </div>

          {/* Active / History tab row — fixed */}
          <div className="px-4 pb-2 flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setTaskTab("ACTIVE")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                taskTab === "ACTIVE"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              Active Tasks ({activeCount})
            </button>
            <button
              onClick={() => setTaskTab("HISTORY")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                taskTab === "HISTORY"
                  ? "bg-green-50 text-green-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              Task History ({completedLogs.length + skippedLogs.length + missedLogs.length})
            </button>
          </div>

          {/* Search bar row — fixed (only shown on Active tab) */}
          {taskTab === "ACTIVE" && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter tasks…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg transition-colors flex-shrink-0">
                <Filter size={13} /> Filter
              </button>
            </div>
          )}

          {/* Scrollable area — tasks + census together */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {taskTab === "ACTIVE" && (
              <>
                {isLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Spinner />
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600">
                    Unable to load tasks. Please refresh.
                  </div>
                )}

                {!isLoading && tasks && filteredTasks.length === 0 && (
                  <EmptyState
                    icon={<ClipboardList size={40} />}
                    title="No active tasks"
                    description="All tasks are complete or no tasks have been set up for this shift."
                  />
                )}

                {!isLoading && tasks && filteredTasks.length > 0 && (
                  <>
                    {BUCKETS.map((bucket) =>
                      tasksByBucket[bucket]?.length > 0 ? (
                        <TaskBucket
                          key={bucket}
                          bucket={bucket}
                          tasks={tasksByBucket[bucket]}
                          onTaskClick={setSelectedTask}
                          onComplete={handleComplete}
                          defaultCollapsed={bucket === "LATER"}
                        />
                      ) : null
                    )}
                  </>
                )}

              </>
            )}

            {taskTab === "HISTORY" && (
              <div className="space-y-4">
                {completedLogs.length === 0 && skippedLogs.length === 0 && missedLogs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <p className="text-sm">No completed, skipped, or missed tasks yet this shift.</p>
                  </div>
                )}

                {completedLogs.length > 0 && (
                  <div>
                    <button
                      onClick={() => setCompletedOpen((v) => !v)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1 hover:text-gray-600 transition-colors"
                    >
                      <ChevronDown
                        size={13}
                        className={cn("transition-transform duration-200", completedOpen ? "" : "-rotate-90")}
                      />
                      Completed ({completedLogs.length})
                    </button>
                    {completedOpen && (
                      <div className="space-y-0.5">
                        {completedLogs.map((log) => (
                          <CompletedTaskRow key={log.id} log={log} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {skippedLogs.length > 0 && (
                  <div>
                    <button
                      onClick={() => setSkippedOpen((v) => !v)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1 hover:text-gray-600 transition-colors"
                    >
                      <ChevronDown
                        size={13}
                        className={cn("transition-transform duration-200", skippedOpen ? "" : "-rotate-90")}
                      />
                      Skipped ({skippedLogs.length})
                    </button>
                    {skippedOpen && (
                      <div className="space-y-0.5">
                        {skippedLogs.map((log) => (
                          <SkippedTaskRow key={log.id} log={log} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {missedLogs.length > 0 && (
                  <div>
                    <button
                      onClick={() => setMissedOpen((v) => !v)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wide px-1 mb-1 hover:text-rose-600 transition-colors"
                    >
                      <ChevronDown
                        size={13}
                        className={cn("transition-transform duration-200", missedOpen ? "" : "-rotate-90")}
                      />
                      Missed ({missedLogs.length})
                    </button>
                    {missedOpen && (
                      <div className="space-y-0.5">
                        {missedLogs.map((log) => (
                          <MissedTaskRow key={log.id} log={log} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Census Cards — scrollable below tasks */}
            {assignments.length > 0 && (
              <div className="mt-2 pt-4 border-t border-gray-100">
                <CensusCards assignments={assignments} enrichedTasks={tasks ?? []} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Task Modal */}
      <TaskInteractionModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {/* Undo Toast */}
      <UndoToast />
    </div>
  );
}
