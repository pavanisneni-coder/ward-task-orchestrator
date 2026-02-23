import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Home, ChevronRight, RefreshCw, Copy, Printer,
  CheckSquare, AlertTriangle, Activity, Plus
} from "lucide-react";
import { useSessionStore } from "../stores/session.store";
import { useGenerateHandover, useNurses, useTaskLogs } from "../hooks/queries";
import { Button, Spinner, Card } from "../components/ui";
import { api } from "../lib/api";
import { cn, getNurseAvatar, getRoleLabel, getCurrentShiftWindow, formatShiftTime } from "../lib/utils";
import type { HandoverSummary } from "../types";

export function HandoverPage() {
  const navigate = useNavigate();
  const { currentNurse, currentShift, clearSession } = useSessionStore();
  const generateHandover = useGenerateHandover();
  const { data: nurses } = useNurses();

  const { data: taskLogs } = useTaskLogs(currentShift?.id);
  const completedCount = taskLogs?.filter((l) => !l.wasSkipped).length ?? 0;
  const skippedLogs    = taskLogs?.filter((l) =>  l.wasSkipped) ?? [];

  const [summary, setSummary] = useState<HandoverSummary | null>(null);
  const [additionalNote, setAdditionalNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [handoverNurseId, setHandoverNurseId] = useState("");

  // Force re-render every 30s so the countdown stays accurate
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // 30-min gate: block generation/completion until 30 min before shift end
  const minutesUntilEnd = currentShift
    ? (new Date(currentShift.endTime).getTime() - Date.now()) / 60000
    : Infinity;
  const canSubmit = minutesUntilEnd <= 30;

  const minsUntilGate = Math.ceil(minutesUntilEnd - 30);
  const availableLabel = minsUntilGate > 60
    ? `Available in ${Math.ceil(minsUntilGate / 60)}h`
    : `Available in ${minsUntilGate}m`;

  const shiftWindow = getCurrentShiftWindow();

  if (!currentNurse || !currentShift) {
    navigate("/");
    return null;
  }

  const handleGenerate = async () => {
    const result = await generateHandover.mutateAsync({
      shiftId: currentShift.id,
      handoverNurseId: handoverNurseId || undefined,
    });
    setSummary(result);
    setReviewed(false);
  };

  const handleComplete = async () => {
    if (summary && !reviewed) return;
    setCompleting(true);
    try {
      await api.shifts.archive(currentShift.id);
      clearSession();
      navigate("/");
    } finally {
      setCompleting(false);
    }
  };

  const pendingTasks = summary?.stats.logs
    ? [] // Computed from full task list ideally; simplified here
    : [];

  const { stats } = summary ?? {};

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Ward 3B Orchestrator</p>
            <p className="text-xs text-gray-400">Shift Handover</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 ml-2 border-l border-gray-100 pl-3">
            <span>{shiftWindow.name} • {formatShiftTime(currentShift.startTime, currentShift.endTime)}</span>
            <span className="mx-1">•</span>
            <span>{format(new Date(), "d MMM yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-gray-800">{currentNurse.name}</p>
            <p className="text-xs text-gray-400">{getRoleLabel(currentNurse.role)}</p>
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
            <img
              src={getNurseAvatar(currentNurse.name, currentNurse.avatarUrl)}
              alt={currentNurse.name}
              className="w-full h-full object-cover object-center block"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 hover:text-gray-600">
            <Home size={12} /> Home
          </button>
          <ChevronRight size={12} />
          <button onClick={() => navigate("/dashboard")} className="hover:text-gray-600">Ward 3B</button>
          <ChevronRight size={12} />
          <span className="text-gray-600 font-medium">Shift Handover</span>
        </nav>

        {/* Page Title */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Handover Summary</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review your shift summary and pending tasks before logging out.
              Ensure all critical events are documented.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleGenerate}
            loading={generateHandover.isPending}
            disabled={!canSubmit || generateHandover.isPending}
            className="flex-shrink-0 gap-2"
          >
            <RefreshCw size={14} className={generateHandover.isPending ? "animate-spin" : ""} />
            {canSubmit
              ? (summary ? "Regenerate Summary" : "Generate Summary")
              : availableLabel}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ─── Left: Main Summary ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Generate Prompt if not yet generated */}
            {!summary && !generateHandover.isPending && (
              <Card className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Activity size={28} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">Ready to generate your handover?</h3>
                <p className="text-sm text-gray-400 mb-5 max-w-xs">
                  Our AI will compile your shift logs, completed tasks, skipped tasks, and notes into a clean summary.
                </p>
                <Button onClick={handleGenerate} loading={generateHandover.isPending} disabled={!canSubmit}>
                  {canSubmit ? "Generate Shift Summary" : availableLabel}
                </Button>
              </Card>
            )}

            {generateHandover.isPending && (
              <Card className="p-8 flex flex-col items-center text-center">
                <Spinner className="mb-4 w-10 h-10" />
                <p className="text-sm text-gray-500">Compiling {stats?.logs?.length ?? "..."} log entries...</p>
              </Card>
            )}

            {/* AI Summary Card */}
            {summary && !generateHandover.isPending && (
              <Card className="overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Activity size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">AI-Generated Shift Report</p>
                        <p className="text-xs text-gray-400">
                          Generated at {format(new Date(), "HH:mm")} based on{" "}
                          {summary.stats.stats.completed + summary.stats.stats.skipped} log entries
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(summary.summaryText)}
                      className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Summary text */}
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {summary.summaryText}
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {[
                      { label: "Completed", value: summary.stats.stats.completed, color: "text-green-600 bg-green-50" },
                      { label: "Skipped", value: summary.stats.stats.skipped, color: "text-orange-600 bg-orange-50" },
                      { label: "Were Overdue", value: summary.stats.stats.overdue, color: "text-red-600 bg-red-50" },
                      { label: "Patients", value: summary.stats.stats.patientCount, color: "text-blue-600 bg-blue-50" },
                    ].map((s) => (
                      <div key={s.label} className={cn("rounded-lg p-3 text-center", s.color)}>
                        <p className="text-lg font-bold">{s.value}</p>
                        <p className="text-xs font-medium opacity-80">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Skipped tasks */}
                  {summary.stats.logs.filter((l) => l.wasSkipped).length > 0 && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5 mb-2">
                        <AlertTriangle size={12} /> Skipped Tasks
                      </p>
                      {summary.stats.logs
                        .filter((l) => l.wasSkipped)
                        .map((log) => (
                          <p key={log.id} className="text-xs text-orange-700 mb-1">
                            • {log.patient?.name} (Bed {log.patient?.bedNumber}) — {log.task?.title}
                            {log.skipReason && <span className="text-orange-400"> · {log.skipReason}</span>}
                          </p>
                        ))}
                    </div>
                  )}

                  {/* Recent notes */}
                  {summary.stats.notes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500">Clinical Notes</p>
                      {summary.stats.notes.slice(0, 3).map((note) => (
                        <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">{note.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {note.nurse?.name} • {format(new Date(note.timestamp), "HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
                    />
                    <span className="text-sm text-gray-600">
                      I have reviewed the AI-generated summary for accuracy and made necessary corrections.
                    </span>
                  </label>
                </div>
              </Card>
            )}

            {/* Shift Notes */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  📝 Additional Shift Notes
                </h3>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">Manual Entry</span>
              </div>
              <textarea
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="Add any additional context, maintenance issues, or interpersonal notes here..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {additionalNote && (
                <div className="flex justify-end mt-2">
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    Save Note
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* ─── Right: Actions Panel ──────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Hand Over To dropdown — always visible */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Hand Over To
              </p>
              <select
                value={handoverNurseId}
                onChange={(e) => setHandoverNurseId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select incoming nurse…</option>
                {nurses?.filter((n) => n.id !== currentNurse?.id).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} — {getRoleLabel(n.role)}
                  </option>
                ))}
              </select>
            </div>

            {/* Pending Tasks */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  Pending Tasks
                </h3>
                {skippedLogs.length > 0 && (
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    {skippedLogs.length} Left
                  </span>
                )}
              </div>
              {skippedLogs.length === 0 ? (
                <p className="text-xs text-green-600 flex items-center gap-1.5">
                  <CheckSquare size={13} /> All tasks accounted for
                </p>
              ) : (
                <div className="space-y-2">
                  {skippedLogs
                    .slice(0, 4)
                    .map((log) => (
                      <div key={log.id} className="flex items-start gap-2">
                        <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{log.task?.title}</p>
                          <p className="text-xs text-gray-400">
                            {log.patient?.name} · Skipped
                          </p>
                        </div>
                      </div>
                    ))}
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">
                    View All →
                  </button>
                </div>
              )}
            </Card>

            {/* Complete Handover */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-1">Ready to handover?</h3>
              <p className="text-xs text-gray-400 mb-4">
                By clicking complete, you certify that all information is accurate and tasks have been communicated.
              </p>
              <Button
                variant="primary"
                className="w-full gap-2 mb-2"
                onClick={handleComplete}
                disabled={!canSubmit || !handoverNurseId || (!!summary && !reviewed)}
                loading={completing}
              >
                <CheckSquare size={15} />
                Complete Handover & Logout
              </Button>
              {!handoverNurseId && (
                <p className="text-xs text-center text-gray-400">Select incoming nurse first</p>
              )}
              {!!summary && !reviewed && handoverNurseId && (
                <p className="text-xs text-center text-gray-400">Please review the summary first</p>
              )}
              <button className="w-full flex items-center justify-center gap-2 mt-2 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Printer size={14} />
                Print Report
              </button>
            </Card>

            {/* Shift Stats */}
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Shift at a Glance
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Tasks Completed", value: summary?.stats.stats.completed ?? completedCount, icon: "✅" },
                  { label: "Tasks Skipped", value: summary?.stats.stats.skipped ?? skippedLogs.length, icon: "⏭" },
                  { label: "Late Completions", value: summary?.stats.stats.overdue ?? 0, icon: "⚠️" },
                  { label: "Notes Added", value: summary?.stats.notes.length ?? 0, icon: "📝" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span>{stat.icon}</span> {stat.label}
                    </span>
                    <span className="text-sm font-bold text-gray-800">{stat.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-300">
        System Status: 🟢 Online • Ward Sync: 🟢 Active • Version 2.4.1
      </footer>
    </div>
  );
}
