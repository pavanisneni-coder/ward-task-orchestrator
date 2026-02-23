import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Plus, AlertTriangle, Settings } from "lucide-react";
import { useNurses } from "../hooks/queries";
import { api } from "../lib/api";
import { useSessionStore } from "../stores/session.store";
import { Spinner } from "../components/ui";
import { cn, getRoleLabel, getNurseAvatar, getCurrentShiftWindow } from "../lib/utils";
import type { Nurse } from "../types";

export function NurseSelection() {
  const navigate = useNavigate();
  const { data: nurses, isLoading, error } = useNurses();
  const { setNurse, setShift } = useSessionStore();
  const [selecting, setSelecting] = useState<string | null>(null);
  const now = new Date();
  const shiftWindow = getCurrentShiftWindow();

  const handleSelect = async (nurse: Nurse) => {
    if (selecting) return;
    setSelecting(nurse.id);
    try {
      const shift = await api.shifts.getActive(nurse.id);
      setNurse(nurse);
      setShift(shift);
      navigate("/dashboard");
    } catch {
      setSelecting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
        {/* Left — logo + hospital name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">St. Mary's Hospital</p>
            <p className="text-xs text-gray-400 mt-0.5">General Ward B • 3rd Floor</p>
          </div>
        </div>

        {/* Right — shift info + clock */}
        <div className="flex items-center gap-0">
          {/* Shift badge */}
          <div className="text-right pr-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-md">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              {shiftWindow.name.toUpperCase()}
            </span>
            <p className="text-xs text-gray-400 mt-1">{shiftWindow.start} – {shiftWindow.end}</p>
          </div>
          {/* Vertical divider */}
          <div className="w-px h-10 bg-gray-200 mx-2" />
          {/* Clock */}
          <div className="text-right pl-4">
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
              {format(now, "HH:mm")}
            </p>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">
              {format(now, "EEE, d MMM")}
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Who is signing in?</h1>
        <p className="text-gray-500 mb-10">Select your profile below to access the task dashboard.</p>

        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-gray-400 text-sm">Loading ward staff...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <AlertTriangle size={16} />
            <span className="text-sm">Unable to load nurses. Please check connection.</span>
          </div>
        )}

        {nurses && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
            {nurses.map((nurse) => {
              const isSelecting = selecting === nurse.id;
              return (
                <button
                  key={nurse.id}
                  onClick={() => handleSelect(nurse)}
                  disabled={!!selecting}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 transition-all duration-200",
                    "hover:border-blue-300 hover:shadow-card-hover focus:outline-none focus:border-blue-400",
                    isSelecting
                      ? "border-blue-400 shadow-card-hover scale-[0.98]"
                      : "border-gray-100 shadow-card",
                    selecting && !isSelecting && "opacity-40 cursor-not-allowed"
                  )}
                  aria-label={`Sign in as ${nurse.name}`}
                >
                  {/* Active shift indicator */}
                  <span
                    className={cn(
                      "absolute top-3 right-3 w-2.5 h-2.5 rounded-full",
                      nurse.hasActiveShift
                        ? "bg-green-500 animate-pulse"
                        : "bg-gray-300"
                    )}
                    title={nurse.hasActiveShift ? "On active shift" : "No active shift"}
                  />

                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {isSelecting ? (
                      <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
                        <Spinner className="border-white border-t-transparent w-7 h-7" />
                      </div>
                    ) : (
                      <img
                        src={getNurseAvatar(nurse.name, nurse.avatarUrl)}
                        alt={nurse.name}
                        className="w-full h-full object-cover object-center block"
                      />
                    )}
                  </div>

                  {/* Name + Role */}
                  <div className="text-center">
                    <p className="font-semibold text-gray-400 group-hover:text-gray-900 text-sm leading-tight transition-colors duration-150">
                      {nurse.name}
                    </p>
                    <span className={cn(
                      "inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 transition-colors duration-150",
                      nurse.role === "Head Nurse"
                        ? "group-hover:bg-purple-100 group-hover:text-purple-700"
                        : "group-hover:bg-blue-100 group-hover:text-blue-700"
                    )}>
                      {getRoleLabel(nurse.role)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 flex items-center justify-between text-xs text-gray-400 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span>System Online • v2.4.1</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 hover:text-gray-600 transition-colors">
            <AlertTriangle size={13} />
            Report Issue
          </button>
          <button className="flex items-center gap-1.5 hover:text-gray-600 transition-colors">
            <Settings size={13} />
            Admin Login
          </button>
        </div>
      </footer>
    </div>
  );
}
