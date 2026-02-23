import { useNavigate } from "react-router-dom";
import { Plus, LogOut, Users } from "lucide-react";
import { useNurses } from "../hooks/queries";
import { useSessionStore } from "../stores/session.store";
import { Spinner } from "../components/ui";
import { cn, getInitials, getRoleLabel, getRoleColor, getNurseAvatar } from "../lib/utils";

export function Staff() {
  const navigate = useNavigate();
  const { currentNurse, currentShift, clearSession } = useSessionStore();
  const { data: nurses, isLoading, error } = useNurses();

  if (!currentNurse || !currentShift) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-gray-900 text-sm">Ward 3B Orchestrator</span>

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {(["Dashboard", "Patients", "Staff", "Handover"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === "Dashboard") navigate("/dashboard");
                  else if (tab === "Patients") navigate("/patients");
                  else if (tab === "Handover") navigate("/handover");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  tab === "Staff"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

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

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Users size={18} className="text-blue-600" />
          <h1 className="font-bold text-gray-900 text-lg">Staff</h1>
          {nurses && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {nurses.length} staff members
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600">
            Unable to load staff. Please refresh.
          </div>
        )}

        {nurses && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {nurses.map((nurse) => (
              <div
                key={nurse.id}
                className="relative bg-white rounded-2xl border border-gray-100 p-5 flex flex-col items-center gap-3 shadow-sm"
              >
                {/* Active shift dot */}
                <span
                  className={cn(
                    "absolute top-3 right-3 w-2.5 h-2.5 rounded-full",
                    nurse.hasActiveShift ? "bg-green-500 animate-pulse" : "bg-gray-300"
                  )}
                  title={nurse.hasActiveShift ? "On active shift" : "No active shift"}
                />

                {/* Avatar */}
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                  <img
                    src={getNurseAvatar(nurse.name, nurse.avatarUrl)}
                    alt={nurse.name}
                    className="w-full h-full object-cover object-center block"
                  />
                </div>

                {/* Name + Role */}
                <div className="text-center">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{nurse.name}</p>
                  <span className={cn("inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded", getRoleColor(nurse.role))}>
                    {getRoleLabel(nurse.role)}
                  </span>
                </div>

                {/* Patient count */}
                {nurse.hasActiveShift && (
                  <p className="text-xs text-gray-400">
                    {nurse.patientCount ?? 0} patient{(nurse.patientCount ?? 0) !== 1 ? "s" : ""}
                  </p>
                )}

                {/* Shift status */}
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  nurse.hasActiveShift
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-50 text-gray-400"
                )}>
                  {nurse.hasActiveShift ? "On Shift" : "Off Shift"}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
