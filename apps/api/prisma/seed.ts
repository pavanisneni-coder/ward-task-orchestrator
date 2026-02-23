process.env.TZ = "Asia/Kolkata"; // Pin to IST — must be before any date import
import { PrismaClient, TaskType } from "@prisma/client";
import { addDays, addMinutes, startOfDay, setHours, setMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Ward Task Orchestration System...");

  await prisma.note.deleteMany();
  await prisma.taskLog.deleteMany();
  await prisma.nurseAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.nurse.deleteMany();

  // ─── Nurses ────────────────────────────────────────────────────────────────
  const nurses = await Promise.all([
    prisma.nurse.create({ data: { name: "Priya Sharma",  role: "Head Nurse", avatarUrl: "/avatars/nurses/priya-sharma.png"  } }), // 0
    prisma.nurse.create({ data: { name: "Rekha Nair",    role: "RN",         avatarUrl: "/avatars/nurses/rekha-nair.png"    } }), // 1
    prisma.nurse.create({ data: { name: "Sunita Yadav",  role: "RN",         avatarUrl: "/avatars/nurses/sunita-yadav.png"  } }), // 2
    prisma.nurse.create({ data: { name: "Meena Pillai",  role: "LPN",        avatarUrl: "/avatars/nurses/meena-pillai.png"  } }), // 3
    prisma.nurse.create({ data: { name: "Anita Joshi",   role: "CNA",        avatarUrl: "/avatars/nurses/anita-joshi.png"   } }), // 4
    prisma.nurse.create({ data: { name: "Deepa Patel",   role: "RN",         avatarUrl: "/avatars/nurses/deepa-patel.png"   } }), // 5
    prisma.nurse.create({ data: { name: "Kavitha Menon", role: "LPN",        avatarUrl: "/avatars/nurses/kavitha-menon.png" } }), // 6
    prisma.nurse.create({ data: { name: "Rohini Desai",  role: "CNA",        avatarUrl: "/avatars/nurses/rohini-desai.png"  } }), // 7
  ]);

  console.log(`✅ Created ${nurses.length} nurses`);

  // ─── Patients ───────────────────────────────────────────────────────────────
  const patients = await Promise.all([
    prisma.patient.create({ data: { name: "Arjun Mehta",      bedNumber: "104", age: 58, gender: "M", diagnosis: "Type 2 Diabetes + Hypertension",      status: "STABLE"      } }), // 0
    prisma.patient.create({ data: { name: "Savitri Bai",      bedNumber: "106", age: 72, gender: "F", diagnosis: "Post-hip replacement",                 status: "OBSERVATION" } }), // 1
    prisma.patient.create({ data: { name: "Ramesh Gupta",     bedNumber: "108", age: 45, gender: "M", diagnosis: "Acute Appendicitis - post-op",          status: "POST_OP"     } }), // 2
    prisma.patient.create({ data: { name: "Lalitha Krishnan", bedNumber: "110", age: 65, gender: "F", diagnosis: "COPD exacerbation",                    status: "STABLE"      } }), // 3
    prisma.patient.create({ data: { name: "Vikram Singh",     bedNumber: "112", age: 38, gender: "M", diagnosis: "Dengue Fever - fluid management",       status: "OBSERVATION" } }), // 4
    prisma.patient.create({ data: { name: "Nalini Reddy",     bedNumber: "114", age: 55, gender: "F", diagnosis: "Acute MI - stable",                    status: "STABLE"      } }), // 5
    prisma.patient.create({ data: { name: "Suresh Iyer",      bedNumber: "116", age: 62, gender: "M", diagnosis: "Pneumonia",                            status: "STABLE"      } }), // 6
    prisma.patient.create({ data: { name: "Padmavathi Rao",   bedNumber: "118", age: 49, gender: "F", diagnosis: "Cholecystitis - pre-op",               status: "OBSERVATION" } }), // 7
  ]);

  console.log(`✅ Created ${patients.length} patients`);

  // ─── Shifts + Assignments — TODAY ONLY (3 windows × 3 nurses = 9 shifts) ───
  //
  // Rotation formula: for window k (0–2), nurses = [(k×3)%8, (k×3+1)%8, (k×3+2)%8]
  //
  //  k | Window  | Nurses (indices)
  //  0 | Morning | 0, 1, 2   Priya, Rekha, Sunita
  //  1 | Evening | 3, 4, 5   Meena, Anita, Deepa
  //  2 | Night   | 6, 7, 0   Kavitha, Rohini, Priya
  //
  // Patient distribution per window (8 patients, 3 nurses):
  //   Nurse[0]: patients [0, 1, 2]  → Arjun, Savitri, Ramesh   (3 patients)
  //   Nurse[1]: patients [3, 4]     → Lalitha, Vikram           (2 patients)
  //   Nurse[2]: patients [5, 6, 7]  → Nalini, Suresh, Padmavathi (3 patients)

  const PATIENT_GROUPS = [[0, 1, 2], [3, 4], [5, 6, 7]];
  const today = startOfDay(new Date());
  const now = new Date();

  // Helper: now-relative anchor — negative = overdue, positive = future
  const rel = (m: number): Date => addMinutes(now, m);

  // shiftMap[nurseId][dayOffset][windowLabel] — used to reference shifts for notes + seed logs
  const shiftMap: Record<string, Record<number, Record<string, { id: string }>>> = {};

  let totalShifts = 0;
  let totalAssignments = 0;

  for (let dayOffset = 0; dayOffset < 1; dayOffset++) {
    const baseDay = addDays(today, dayOffset);
    const windows = [
      { label: "Morning", start: setHours(setMinutes(baseDay, 0), 7),  end: setHours(setMinutes(baseDay, 0), 15) },
      { label: "Evening", start: setHours(setMinutes(baseDay, 0), 15), end: setHours(setMinutes(baseDay, 0), 23) },
      { label: "Night",   start: setHours(setMinutes(baseDay, 0), 23), end: setHours(setMinutes(addDays(baseDay, 1), 0), 7) },
    ];

    for (let wi = 0; wi < 3; wi++) {
      const k = dayOffset * 3 + wi;
      const win = windows[wi];
      const nurseGroupIndices = [(k * 3 + 0) % 8, (k * 3 + 1) % 8, (k * 3 + 2) % 8];

      for (let ni = 0; ni < 3; ni++) {
        const nurse = nurses[nurseGroupIndices[ni]];

        const shift = await prisma.shift.create({
          data: { nurseId: nurse.id, startTime: win.start, endTime: win.end },
        });
        totalShifts++;

        if (!shiftMap[nurse.id]) shiftMap[nurse.id] = {};
        if (!shiftMap[nurse.id][dayOffset]) shiftMap[nurse.id][dayOffset] = {};
        shiftMap[nurse.id][dayOffset][win.label] = shift;

        for (const patientIdx of PATIENT_GROUPS[ni]) {
          await prisma.nurseAssignment.create({
            data: { nurseId: nurse.id, patientId: patients[patientIdx].id, shiftId: shift.id },
          });
          totalAssignments++;
        }
      }
    }
  }

  console.log(`✅ Created ${totalShifts} shifts (1 day × 3 windows × 3 nurses)`);
  console.log(`✅ Created ${totalAssignments} nurse–patient assignments`);

  // ─── Tasks — 5-6 per patient, now-relative anchors for instant bucket spread ──
  //
  // rel(X) = addMinutes(now, X)
  //   Negative X → OVERDUE bucket  (task already past due)
  //   0–10 min  → DUE_NOW bucket
  //   11–30 min → DUE_SOON bucket
  //   > 30 min  → LATER bucket
  //
  // Recurring tasks (frequencyMinutes set) cycle at their frequency from anchor.
  // ONE_TIME tasks (frequencyMinutes null) appear once at their anchor.
  //
  // Staggered offsets ensure all 4 buckets are populated at any time of day.

  const tasks = await Promise.all([

    // ── Arjun Mehta (Bed 104) — Diabetes + HTN — 6 tasks ─────────────────────
    // offsets: −90, +5, +22, +55, +85, +120
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.MONITORING,     title: "Blood Glucose Monitoring",             frequencyMinutes: 120,  anchorTime: rel(-90), graceMinutes: 10, lookaheadMinutes: 20  } }), // t0
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.MONITORING,     title: "BP & Pulse Check",                     frequencyMinutes: 180,  anchorTime: rel(5),   graceMinutes: 15, lookaheadMinutes: 30  } }), // t1
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.MEDICATION,     title: "IV Antibiotics (Ceftriaxone 1g)",      frequencyMinutes: 360,  anchorTime: rel(22),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t2
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.MEDICATION,     title: "Metformin 500mg (Oral)",               frequencyMinutes: 720,  anchorTime: rel(55),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t3
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.CARE_PROCEDURE, title: "Wound Site Inspection",                frequencyMinutes: null, anchorTime: rel(85),  graceMinutes: 20, lookaheadMinutes: 40  } }), // t4
    prisma.task.create({ data: { patientId: patients[0].id, taskType: TaskType.CARE_PROCEDURE, title: "Patient Education (Diabetes Diet)",    frequencyMinutes: null, anchorTime: rel(120), graceMinutes: 30, lookaheadMinutes: 60  } }), // t5

    // ── Savitri Bai (Bed 106) — Post-hip replacement — 5 tasks ───────────────
    // offsets: −30, +8, +18, +60, +95
    prisma.task.create({ data: { patientId: patients[1].id, taskType: TaskType.MONITORING,     title: "Pain Score Assessment",                frequencyMinutes: 120,  anchorTime: rel(-30), graceMinutes: 10, lookaheadMinutes: 20  } }), // t6
    prisma.task.create({ data: { patientId: patients[1].id, taskType: TaskType.MEDICATION,     title: "Paracetamol 500mg IV",                 frequencyMinutes: 360,  anchorTime: rel(8),   graceMinutes: 20, lookaheadMinutes: 40  } }), // t7
    prisma.task.create({ data: { patientId: patients[1].id, taskType: TaskType.MONITORING,     title: "Hip Wound Dressing Check",             frequencyMinutes: 240,  anchorTime: rel(18),  graceMinutes: 20, lookaheadMinutes: 40  } }), // t8
    prisma.task.create({ data: { patientId: patients[1].id, taskType: TaskType.CARE_PROCEDURE, title: "Physiotherapy Support (Ambulation)",  frequencyMinutes: null, anchorTime: rel(60),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t9
    prisma.task.create({ data: { patientId: patients[1].id, taskType: TaskType.MEDICATION,     title: "DVT Prophylaxis (Heparin SC)",        frequencyMinutes: 720,  anchorTime: rel(95),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t10

    // ── Ramesh Gupta (Bed 108) — Post-appendectomy — 6 tasks ─────────────────
    // offsets: −70, +3, +25, +48, +78, +105
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.MONITORING,     title: "Vitals Check (Post-op)",               frequencyMinutes: 60,   anchorTime: rel(-70), graceMinutes: 10, lookaheadMinutes: 15  } }), // t11
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.MONITORING,     title: "Drain Output Measurement",             frequencyMinutes: 180,  anchorTime: rel(3),   graceMinutes: 15, lookaheadMinutes: 30  } }), // t12
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.MEDICATION,     title: "Metronidazole 500mg IV",               frequencyMinutes: 480,  anchorTime: rel(25),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t13
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.MEDICATION,     title: "Cefazolin 1g IV (Post-op)",            frequencyMinutes: 240,  anchorTime: rel(48),  graceMinutes: 20, lookaheadMinutes: 40  } }), // t14
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.CARE_PROCEDURE, title: "Post-op Wound Dressing Change",       frequencyMinutes: null, anchorTime: rel(78),  graceMinutes: 20, lookaheadMinutes: 40  } }), // t15
    prisma.task.create({ data: { patientId: patients[2].id, taskType: TaskType.MONITORING,     title: "Bowel Function Assessment",            frequencyMinutes: null, anchorTime: rel(105), graceMinutes: 30, lookaheadMinutes: 60  } }), // t16

    // ── Lalitha Krishnan (Bed 110) — COPD — 5 tasks ──────────────────────────
    // offsets: −45, +4, +20, +65, +100
    prisma.task.create({ data: { patientId: patients[3].id, taskType: TaskType.MONITORING,     title: "SpO2 & Respiratory Rate",              frequencyMinutes: 60,   anchorTime: rel(-45), graceMinutes: 10, lookaheadMinutes: 15  } }), // t17
    prisma.task.create({ data: { patientId: patients[3].id, taskType: TaskType.CARE_PROCEDURE, title: "Nebulization (Salbutamol)",            frequencyMinutes: 360,  anchorTime: rel(4),   graceMinutes: 15, lookaheadMinutes: 30  } }), // t18
    prisma.task.create({ data: { patientId: patients[3].id, taskType: TaskType.MONITORING,     title: "Fluid Intake / Output Chart",          frequencyMinutes: 240,  anchorTime: rel(20),  graceMinutes: 15, lookaheadMinutes: 30  } }), // t19
    prisma.task.create({ data: { patientId: patients[3].id, taskType: TaskType.MEDICATION,     title: "Prednisolone 10mg (Oral)",             frequencyMinutes: 720,  anchorTime: rel(65),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t20
    prisma.task.create({ data: { patientId: patients[3].id, taskType: TaskType.CARE_PROCEDURE, title: "Chest Physiotherapy Session",         frequencyMinutes: null, anchorTime: rel(100), graceMinutes: 30, lookaheadMinutes: 60  } }), // t21

    // ── Vikram Singh (Bed 112) — Dengue — 5 tasks ─────────────────────────────
    // offsets: −55, +6, +28, +70, +110
    prisma.task.create({ data: { patientId: patients[4].id, taskType: TaskType.MONITORING,     title: "Vitals Check",                         frequencyMinutes: 120,  anchorTime: rel(-55), graceMinutes: 10, lookaheadMinutes: 20  } }), // t22
    prisma.task.create({ data: { patientId: patients[4].id, taskType: TaskType.MONITORING,     title: "IV Fluid Rate Monitor (NS)",           frequencyMinutes: 60,   anchorTime: rel(6),   graceMinutes: 10, lookaheadMinutes: 15  } }), // t23
    prisma.task.create({ data: { patientId: patients[4].id, taskType: TaskType.MONITORING,     title: "Platelet Count Review",                frequencyMinutes: 240,  anchorTime: rel(28),  graceMinutes: 20, lookaheadMinutes: 40  } }), // t24
    prisma.task.create({ data: { patientId: patients[4].id, taskType: TaskType.MEDICATION,     title: "Anti-emetic (Ondansetron 4mg IV)",    frequencyMinutes: 480,  anchorTime: rel(70),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t25
    prisma.task.create({ data: { patientId: patients[4].id, taskType: TaskType.MONITORING,     title: "Fluid Balance Chart Update",          frequencyMinutes: null, anchorTime: rel(110), graceMinutes: 30, lookaheadMinutes: 60  } }), // t26

    // ── Nalini Reddy (Bed 114) — Post-MI — 6 tasks ────────────────────────────
    // offsets: −60, +10, +15, +50, +88, +115
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.MONITORING,     title: "BP & Cardiac Monitoring",              frequencyMinutes: 120,  anchorTime: rel(-60), graceMinutes: 15, lookaheadMinutes: 30  } }), // t27
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.MONITORING,     title: "Fluid Intake Restriction Check",       frequencyMinutes: 180,  anchorTime: rel(10),  graceMinutes: 15, lookaheadMinutes: 30  } }), // t28
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.MONITORING,     title: "12-lead ECG",                          frequencyMinutes: null, anchorTime: rel(15),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t29
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.MEDICATION,     title: "Aspirin 75mg (Oral)",                  frequencyMinutes: 1440, anchorTime: rel(50),  graceMinutes: 60, lookaheadMinutes: 120 } }), // t30
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.CARE_PROCEDURE, title: "Cardiac Rehab Counselling",           frequencyMinutes: null, anchorTime: rel(88),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t31
    prisma.task.create({ data: { patientId: patients[5].id, taskType: TaskType.MEDICATION,     title: "Atorvastatin 40mg (Evening Dose)",    frequencyMinutes: null, anchorTime: rel(115), graceMinutes: 30, lookaheadMinutes: 60  } }), // t32

    // ── Suresh Iyer (Bed 116) — Pneumonia — 5 tasks ───────────────────────────
    // offsets: −35, +12, +30, +58, +92
    prisma.task.create({ data: { patientId: patients[6].id, taskType: TaskType.MONITORING,     title: "SpO2 Monitoring",                      frequencyMinutes: 60,   anchorTime: rel(-35), graceMinutes: 10, lookaheadMinutes: 15  } }), // t33
    prisma.task.create({ data: { patientId: patients[6].id, taskType: TaskType.MONITORING,     title: "Temperature Check",                    frequencyMinutes: 120,  anchorTime: rel(12),  graceMinutes: 10, lookaheadMinutes: 20  } }), // t34
    prisma.task.create({ data: { patientId: patients[6].id, taskType: TaskType.MONITORING,     title: "Chest Auscultation",                   frequencyMinutes: 180,  anchorTime: rel(30),  graceMinutes: 15, lookaheadMinutes: 30  } }), // t35
    prisma.task.create({ data: { patientId: patients[6].id, taskType: TaskType.MEDICATION,     title: "Azithromycin 500mg IV",                frequencyMinutes: 1440, anchorTime: rel(58),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t36
    prisma.task.create({ data: { patientId: patients[6].id, taskType: TaskType.CARE_PROCEDURE, title: "Respiratory Physiotherapy",           frequencyMinutes: null, anchorTime: rel(92),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t37

    // ── Padmavathi Rao (Bed 118) — Pre-op Cholecystitis — 5 tasks ─────────────
    // offsets: −20, +7, +24, +68, +108
    prisma.task.create({ data: { patientId: patients[7].id, taskType: TaskType.CARE_PROCEDURE, title: "NPO Verification",                    frequencyMinutes: null, anchorTime: rel(-20), graceMinutes: 15, lookaheadMinutes: 30  } }), // t38
    prisma.task.create({ data: { patientId: patients[7].id, taskType: TaskType.MONITORING,     title: "Pre-op Vitals",                        frequencyMinutes: 120,  anchorTime: rel(7),   graceMinutes: 10, lookaheadMinutes: 20  } }), // t39
    prisma.task.create({ data: { patientId: patients[7].id, taskType: TaskType.CARE_PROCEDURE, title: "Consent Form Verification",           frequencyMinutes: null, anchorTime: rel(24),  graceMinutes: 30, lookaheadMinutes: 60  } }), // t40
    prisma.task.create({ data: { patientId: patients[7].id, taskType: TaskType.MONITORING,     title: "Pre-op IV Access Check",               frequencyMinutes: null, anchorTime: rel(68),  graceMinutes: 15, lookaheadMinutes: 30  } }), // t41
    prisma.task.create({ data: { patientId: patients[7].id, taskType: TaskType.CARE_PROCEDURE, title: "Surgical Checklist Completion",       frequencyMinutes: null, anchorTime: rel(108), graceMinutes: 30, lookaheadMinutes: 60  } }), // t42
  ]);

  console.log(`✅ Created ${tasks.length} tasks`);

  // ─── Seed Task Logs — morning shift history so History tab has initial data ──
  //
  // Target: Priya Sharma's Day-0 morning shift, patients 0/1/2.
  // 3 completed + 1 skipped so both counters show non-zero on first load.
  //
  // Completed logs placed relative to now (a bit before the overdue anchors).

  const priyaD0Morning = shiftMap[nurses[0].id]?.[0]?.["Morning"];

  if (priyaD0Morning) {
    const shiftId = priyaD0Morning.id;

    // 1. Completed: Blood Glucose Monitoring (Arjun, t0) — completed ~88 min ago
    //    anchor rel(-90) freq 120 → completed 2 min after it was due
    await prisma.taskLog.create({
      data: {
        taskId:      tasks[0].id,
        nurseId:     nurses[0].id,
        shiftId,
        patientId:   patients[0].id,
        completedAt: addMinutes(now, -88),
        wasOverdue:  false,
        wasSkipped:  false,
        skipReason:  null,
      },
    });

    // 2. Completed: Pain Score Assessment (Savitri, t6) — completed ~28 min ago
    //    anchor rel(-30) freq 120 → completed 2 min after it was due
    await prisma.taskLog.create({
      data: {
        taskId:      tasks[6].id,
        nurseId:     nurses[0].id,
        shiftId,
        patientId:   patients[1].id,
        completedAt: addMinutes(now, -28),
        wasOverdue:  false,
        wasSkipped:  false,
        skipReason:  null,
      },
    });

    // 3. Completed: Vitals Check Post-op (Ramesh, t11) — completed ~68 min ago
    //    anchor rel(-70) freq 60 → completed 2 min after it was due
    await prisma.taskLog.create({
      data: {
        taskId:      tasks[11].id,
        nurseId:     nurses[0].id,
        shiftId,
        patientId:   patients[2].id,
        completedAt: addMinutes(now, -68),
        wasOverdue:  false,
        wasSkipped:  false,
        skipReason:  null,
      },
    });

    // 4. Skipped: Drain Output Measurement (Ramesh, t12) — manual skip ~65 min ago
    await prisma.taskLog.create({
      data: {
        taskId:      tasks[12].id,
        nurseId:     nurses[0].id,
        shiftId,
        patientId:   patients[2].id,
        completedAt: addMinutes(now, -65),
        wasOverdue:  false,
        wasSkipped:  true,
        skipReason:  "Drain temporarily clamped — awaiting surgical review",
      },
    });

    console.log("✅ Seeded 3 completed + 1 skipped task logs for Priya's morning shift");
  }

  // ─── Sample Notes ────────────────────────────────────────────────────────────
  const anitaD0Evening = shiftMap[nurses[4].id]?.[0]?.["Evening"];
  const kavithaD0Night = shiftMap[nurses[6].id]?.[0]?.["Night"];

  if (priyaD0Morning) {
    await prisma.note.create({
      data: {
        patientId: patients[0].id,
        nurseId:   nurses[0].id,
        shiftId:   priyaD0Morning.id,
        content:   "Patient complained of mild dizziness at 08:30. Dr. Sharma informed. BP was 150/90. Monitoring closely.",
      },
    });
    await prisma.note.create({
      data: {
        patientId: patients[1].id,
        nurseId:   nurses[0].id,
        shiftId:   priyaD0Morning.id,
        content:   "Family visited at 10:00. Physiotherapist Mohan confirmed ambulation session for 14:00. Patient cooperative.",
      },
    });
  }

  if (anitaD0Evening) {
    await prisma.note.create({
      data: {
        patientId: patients[4].id,
        nurseId:   nurses[4].id,
        shiftId:   anitaD0Evening.id,
        content:   "Platelet count dropped to 85,000. Dr. Venkatesh notified. Patient advised complete bed rest. Family counselled.",
      },
    });
  }

  if (kavithaD0Night) {
    await prisma.note.create({
      data: {
        patientId: patients[2].id,
        nurseId:   nurses[6].id,
        shiftId:   kavithaD0Night.id,
        content:   "Post-op drain output 80ml at midnight review. Wound site clean, no signs of infection. IV line patent.",
      },
    });
  }

  console.log("✅ Created sample notes");
  console.log("🎉 Seed complete. Ward is ready.");
  console.log("");
  console.log("📋 Task distribution:");
  console.log("   Arjun Mehta     (104): 6 tasks — Diabetes + HTN");
  console.log("   Savitri Bai     (106): 5 tasks — Post-hip replacement");
  console.log("   Ramesh Gupta    (108): 6 tasks — Post-appendectomy");
  console.log("   Lalitha Krishnan(110): 5 tasks — COPD");
  console.log("   Vikram Singh    (112): 5 tasks — Dengue");
  console.log("   Nalini Reddy    (114): 6 tasks — Post-MI");
  console.log("   Suresh Iyer     (116): 5 tasks — Pneumonia");
  console.log("   Padmavathi Rao  (118): 5 tasks — Pre-op");
  console.log("   Total: 43 tasks");
  console.log("");
  console.log("📋 Shift rotation summary (today only):");
  console.log("   Morning : Priya, Rekha, Sunita");
  console.log("   Evening : Meena, Anita, Deepa");
  console.log("   Night   : Kavitha, Rohini, Priya");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
