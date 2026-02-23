import { useNavigate } from "react-router-dom";
import { LogOut, Users, Plus } from "lucide-react";
import { usePatients } from "../hooks/queries";
import { useSessionStore } from "../stores/session.store";
import { Spinner } from "../components/ui";
import { cn, PATIENT_STATUS_CONFIG, getNurseAvatar, getRoleLabel } from "../lib/utils";

export function Patients() {
  const navigate = useNavigate();
  const { currentNurse, currentShift, clearSession } = useSessionStore();
  const { data: patients, isLoading, error } = usePatients();

  if (!currentNurse || !currentShift) {
    navigate("/");
    return null;
  }

  const assignedNurse = (patient: { assignments: Array<{ shiftId: string; nurse: { name: string } }> }) =>
    patient.assignments.find((a) => a.shiftId === currentShift?.id)?.nurse?.name ?? "Unassigned";

  const myPatients = (patients ?? []).filter((p) =>
    p.assignments?.some((a: any) => a.shiftId === currentShift?.id && a.nurse?.id === currentNurse?.id)
  );
  const otherPatients = (patients ?? []).filter((p) =>
    p.assignments?.some((a: any) => a.shiftId === currentShift?.id) &&
    !p.assignments?.some((a: any) => a.shiftId === currentShift?.id && a.nurse?.id === currentNurse?.id)
  );

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
                  else if (tab === "Staff") navigate("/staff");
                  else if (tab === "Handover") navigate("/handover");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  tab === "Patients"
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
          <h1 className="font-bold text-gray-900 text-lg">Patients</h1>
          {patients && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {patients.length} patients
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
            Unable to load patients. Please refresh.
          </div>
        )}

        {patients && (
          <div className="grid gap-3">
            {myPatients.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-1 mb-1">
                  My Patients ({myPatients.length})
                </p>
                {myPatients.map((patient) => {
                  const statusConfig = PATIENT_STATUS_CONFIG[patient.status];
                  const nurse = assignedNurse(patient);
                  return (
                    <div
                      key={patient.id}
                      className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4 shadow-sm"
                    >
                      <div className="flex-shrink-0 w-14 h-14 bg-blue-50 rounded-xl flex flex-col items-center justify-center">
                        <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide">BED</p>
                        <p className="text-lg font-bold text-blue-700">{patient.bedNumber}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{patient.name}</p>
                          <span className="text-xs text-gray-400">
                            {patient.gender ?? "—"}, {patient.age ?? "—"} yrs
                          </span>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{patient.diagnosis ?? "No diagnosis recorded"}</p>
                      </div>
                      <div className="flex-shrink-0 text-right hidden sm:block">
                        <p className="text-xs text-gray-400">Assigned nurse</p>
                        <p className="text-sm font-medium text-gray-700">{nurse}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {otherPatients.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4 mb-1">
                  Other Patients ({otherPatients.length})
                </p>
                {otherPatients.map((patient) => {
                  const statusConfig = PATIENT_STATUS_CONFIG[patient.status];
                  const nurse = assignedNurse(patient);
                  return (
                    <div
                      key={patient.id}
                      className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4 shadow-sm"
                    >
                      <div className="flex-shrink-0 w-14 h-14 bg-blue-50 rounded-xl flex flex-col items-center justify-center">
                        <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide">BED</p>
                        <p className="text-lg font-bold text-blue-700">{patient.bedNumber}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{patient.name}</p>
                          <span className="text-xs text-gray-400">
                            {patient.gender ?? "—"}, {patient.age ?? "—"} yrs
                          </span>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{patient.diagnosis ?? "No diagnosis recorded"}</p>
                      </div>
                      <div className="flex-shrink-0 text-right hidden sm:block">
                        <p className="text-xs text-gray-400">Assigned nurse</p>
                        <p className="text-sm font-medium text-gray-700">{nurse}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
