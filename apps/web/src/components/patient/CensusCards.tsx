import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { cn, PATIENT_STATUS_CONFIG, TASK_TYPE_CONFIG } from "../../lib/utils";
import { Button } from "../ui";
import { AddTaskModal } from "../task/AddTaskModal";
import { useAddNote } from "../../hooks/queries";
import { useSessionStore } from "../../stores/session.store";
import type { NurseAssignment, EnrichedTask } from "../../types";

interface CensusCardsProps {
  assignments: NurseAssignment[];
  enrichedTasks: EnrichedTask[];
}

export function CensusCards({ assignments, enrichedTasks }: CensusCardsProps) {
  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);
  const [addTaskPatient, setAddTaskPatient] = useState<{ id: string; name: string } | null>(null);
  const [notePatient, setNotePatient] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const { currentNurse, currentShift } = useSessionStore();
  const addNote = useAddNote();

  const scroll = (direction: "left" | "right") => {
    scrollRef?.scrollBy({ left: direction === "left" ? -320 : 320, behavior: "smooth" });
  };

  const getPatientProgress = (patientId: string) => {
    const tasks = enrichedTasks.filter((t) => t.patientId === patientId);
    const total = tasks.length;
    // Count completed tasks this shift (last logged and not overdue)
    const done = tasks.filter((t) => t.lastLog && !t.lastLog.wasSkipped).length;
    return { done, total };
  };

  const getProgressBarColor = (patientId: string) => {
    const tasks = enrichedTasks.filter((t) => t.patientId === patientId);
    if (tasks.some((t) => t.bucket === "OVERDUE")) return "bg-red-500";
    if (tasks.some((t) => t.bucket === "DUE_NOW")) return "bg-blue-500";
    if (tasks.some((t) => t.bucket === "DUE_SOON")) return "bg-amber-400";
    return "bg-green-500";
  };

  const handleSaveNote = async (patientId: string) => {
    if (!noteContent.trim() || !currentNurse || !currentShift) return;
    await addNote.mutateAsync({
      patientId,
      nurseId: currentNurse.id,
      shiftId: currentShift.id,
      content: noteContent,
    });
    setNotePatient(null);
    setNoteContent("");
  };

  return (
    <div className="mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700">Census & Handover Notes</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Scroll Container */}
      <div
        ref={setScrollRef}
        className="flex gap-3 overflow-x-auto pb-3 px-4 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {assignments.map((assignment) => {
          const patient = assignment.patient;
          const { done, total } = getPatientProgress(patient.id);
          const progressPct = total > 0 ? (done / total) * 100 : 0;
          const progressColor = getProgressBarColor(patient.id);
          const statusConfig = PATIENT_STATUS_CONFIG[patient.status as keyof typeof PATIENT_STATUS_CONFIG];
          const latestNote = patient.notes?.[0];
          const isAddingNote = notePatient === patient.id;

          return (
            <div
              key={assignment.id}
              className="flex-shrink-0 w-72 bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden"
            >
              {/* Status bar */}
              <div
                className={cn(
                  "h-1 w-full",
                  patient.status === "STABLE"
                    ? "bg-green-500"
                    : patient.status === "OBSERVATION"
                    ? "bg-orange-500"
                    : patient.status === "POST_OP"
                    ? "bg-purple-500"
                    : "bg-blue-500"
                )}
              />

              <div className="p-4">
                {/* Patient Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {patient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
                      <p className="text-xs text-gray-400">BED {patient.bedNumber}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      statusConfig?.color ?? "bg-gray-100 text-gray-600"
                    )}
                  >
                    {statusConfig?.label ?? patient.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Shift Progress</span>
                    <span className="text-xs font-medium text-gray-600">
                      {done}/{total} Tasks
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={cn("h-1.5 rounded-full transition-all", progressColor)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Upcoming tasks preview */}
                {enrichedTasks
                  .filter((t) => t.patientId === patient.id && t.bucket !== "LATER")
                  .slice(0, 2)
                  .map((t) => (
                    <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <span>{TASK_TYPE_CONFIG[t.taskType].icon}</span>
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}

                {/* Note */}
                <div className="mt-3 min-h-[40px]">
                  {latestNote && !isAddingNote ? (
                    <p className="text-xs text-gray-500 italic leading-relaxed line-clamp-2">
                      "{latestNote.content}"
                    </p>
                  ) : null}

                  {isAddingNote ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Add clinical note..."
                        rows={2}
                        autoFocus
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setNotePatient(null); setNoteContent(""); }}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveNote(patient.id)}
                          disabled={!noteContent.trim() || addNote.isPending}
                          className="flex-1 text-xs bg-blue-600 text-white rounded-md py-1 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-50 px-4 py-2.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    setNotePatient(patient.id);
                    setNoteContent("");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <MessageSquare size={12} />
                  Add Note
                </button>
                <div className="w-px h-4 bg-gray-100" />
                <button
                  onClick={() => setAddTaskPatient({ id: patient.id, name: patient.name })}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus size={12} />
                  Add Task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {addTaskPatient && (
        <AddTaskModal
          open={!!addTaskPatient}
          onClose={() => setAddTaskPatient(null)}
          patientId={addTaskPatient.id}
          patientName={addTaskPatient.name}
        />
      )}
    </div>
  );
}
