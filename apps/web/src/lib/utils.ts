import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInMinutes, format, isToday, isYesterday } from "date-fns";
import type { UrgencyBucket, TaskType, PatientStatus } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFrequency(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.round(hours * 10) / 10}h`;
}

export function formatMinutesRelative(minutes: number): string {
  if (Math.abs(minutes) < 2) return "due now";
  const absMin = Math.abs(minutes);
  if (absMin < 60) {
    return minutes < 0 ? `${absMin}m overdue` : `in ${absMin}m`;
  }
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  const label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return minutes < 0 ? `${label} overdue` : `in ${label}`;
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH:mm");
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm");
}

export function formatShiftTime(start: string, end: string): string {
  return `${format(new Date(start), "HH:mm")} – ${format(new Date(end), "HH:mm")}`;
}

export function formatIndianDate(date: Date = new Date()): string {
  return format(date, "EEE, d MMM yyyy");
}

// ─── Nurse avatar lookup (static local files in /public/avatars/nurses/) ──────
const NURSE_AVATAR_MAP: Record<string, string> = {
  "priya sharma":   "/avatars/nurses/priya-sharma.png",
  "rekha nair":     "/avatars/nurses/rekha-nair.png",
  "sunita yadav":   "/avatars/nurses/sunita-yadav.png",
  "meena pillai":   "/avatars/nurses/meena-pillai.png",
  "anita joshi":    "/avatars/nurses/anita-joshi.png",
  "deepa patel":    "/avatars/nurses/deepa-patel.png",
  "kavitha menon":  "/avatars/nurses/kavitha-menon.png",
  "rohini desai":   "/avatars/nurses/rohini-desai.png",
};

/** Returns the nurse's avatar URL — local file map first, DB value as fallback. */
export function getNurseAvatar(name: string, avatarUrl?: string | null): string {
  return NURSE_AVATAR_MAP[name.toLowerCase()] ?? avatarUrl ?? "";
}

export function getRoleLabel(role: string): string {
  return role === "Head Nurse" ? "Head Nurse" : "Nurse";
}

export function getRoleColor(role: string): string {
  return role === "Head Nurse"
    ? "bg-purple-100 text-purple-700"
    : "bg-blue-100 text-blue-700";
}

export const BUCKET_CONFIG: Record<
  UrgencyBucket,
  { label: string; color: string; bgColor: string; borderColor: string; textColor: string }
> = {
  OVERDUE: {
    label: "Overdue",
    color: "#EF4444",
    bgColor: "bg-ward-overdue-bg",
    borderColor: "border-ward-overdue-border",
    textColor: "text-rose-500",
  },
  DUE_NOW: {
    label: "Due Now",
    color: "#3B82F6",
    bgColor: "bg-ward-due-bg",
    borderColor: "border-ward-due-border",
    textColor: "text-blue-500",
  },
  DUE_SOON: {
    label: "Due Soon",
    color: "#F59E0B",
    bgColor: "bg-ward-soon-bg",
    borderColor: "border-ward-soon-border",
    textColor: "text-amber-500",
  },
  LATER: {
    label: "Later",
    color: "#6B7280",
    bgColor: "bg-ward-later-bg",
    borderColor: "border-gray-200",
    textColor: "text-gray-400",
  },
  COMPLETED: {
    label: "Completed",
    color: "#10B981",
    bgColor: "bg-green-50",
    borderColor: "border-green-100",
    textColor: "text-green-600",
  },
};

export const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string }> = {
  MEDICATION: { label: "Medication", icon: "💊", color: "text-blue-600 bg-blue-50" },
  MONITORING: { label: "Monitoring", icon: "📊", color: "text-purple-600 bg-purple-50" },
  CARE_PROCEDURE: { label: "Care Procedure", icon: "🩺", color: "text-teal-600 bg-teal-50" },
  ONE_TIME: { label: "One-Time", icon: "📋", color: "text-gray-600 bg-gray-50" },
};

export const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; color: string }> = {
  STABLE: { label: "Stable", color: "bg-green-100 text-green-700" },
  OBSERVATION: { label: "Observation", color: "bg-orange-100 text-orange-700" },
  POST_OP: { label: "Post-Op", color: "bg-purple-100 text-purple-700" },
  DISCHARGE: { label: "Discharge", color: "bg-blue-100 text-blue-700" },
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + "s"}`;
}

export function getCurrentShiftWindow(): { name: string; start: string; end: string } {
  const now = new Date();
  const h = now.getHours();
  const totalMins = h * 60 + now.getMinutes();
  // Allow 30-min early display of next shift (mirrors backend logic)
  if ((totalMins >= 14 * 60 + 30 && totalMins < 15 * 60) || (totalMins >= 15 * 60 && totalMins < 23 * 60))
    return { name: "Evening Shift", start: "15:00", end: "23:00" };
  if ((totalMins >= 22 * 60 + 30 && totalMins < 23 * 60) || h >= 23 || h < 7)
    return { name: "Night Shift", start: "23:00", end: "07:00" };
  return { name: "Morning Shift", start: "07:00", end: "15:00" };
}
