import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTINE_TASKS,
  addDaysIso,
  doesRoutineApplyOnDate,
  getEffectiveAutoDetectSource,
  getTaskVerificationMode,
  normalizeRoutineTaskConfig,
  type RoutineTaskConfig,
} from "../src/lib/unified-calendar";

describe("Unified Calendar & Routine Engine", () => {
  it("correctly evaluates daily, weekday, custom day-of-week, biweekly, and monthly routines", () => {
    const dailyTask = DEFAULT_ROUTINE_TASKS[0];
    expect(doesRoutineApplyOnDate(dailyTask, "2026-11-13")).toBe(true); // Friday
    expect(doesRoutineApplyOnDate(dailyTask, "2026-11-15")).toBe(true); // Sunday

    const weekdayTask: RoutineTaskConfig = {
      ...dailyTask,
      frequency: "lunes_a_viernes",
    };
    expect(doesRoutineApplyOnDate(weekdayTask, "2026-11-13")).toBe(true); // Friday
    expect(doesRoutineApplyOnDate(weekdayTask, "2026-11-14")).toBe(false); // Saturday
    expect(doesRoutineApplyOnDate(weekdayTask, "2026-11-15")).toBe(false); // Sunday

    const mondayBiosec = DEFAULT_ROUTINE_TASKS.find(
      (t) => t.id === "routine-weekly-biosecurity",
    )!;
    expect(doesRoutineApplyOnDate(mondayBiosec, "2026-11-09")).toBe(true); // Monday
    expect(doesRoutineApplyOnDate(mondayBiosec, "2026-11-10")).toBe(false); // Tuesday

    const saturdayWeighing = DEFAULT_ROUTINE_TASKS.find(
      (t) => t.id === "routine-weekly-weighing",
    )!;
    expect(doesRoutineApplyOnDate(saturdayWeighing, "2026-11-14")).toBe(true); // Saturday
    expect(doesRoutineApplyOnDate(saturdayWeighing, "2026-11-13")).toBe(false); // Friday

    const biweeklyTask: RoutineTaskConfig = {
      ...dailyTask,
      frequency: "quincenal",
    };
    expect(doesRoutineApplyOnDate(biweeklyTask, "2026-11-01")).toBe(true);
    expect(doesRoutineApplyOnDate(biweeklyTask, "2026-11-15")).toBe(true);
    expect(doesRoutineApplyOnDate(biweeklyTask, "2026-11-13")).toBe(false);

    const disabledTask: RoutineTaskConfig = {
      ...dailyTask,
      enabled: false,
    };
    expect(doesRoutineApplyOnDate(disabledTask, "2026-11-13")).toBe(false);
  });

  it("shifts ISO dates accurately across month boundaries", () => {
    expect(addDaysIso("2026-11-13", 7)).toBe("2026-11-20");
    expect(addDaysIso("2026-11-13", 30)).toBe("2026-12-13");
    expect(addDaysIso("2026-11-13", -14)).toBe("2026-10-30");
  });

  it("classifies default routines into real verification modes and normalizes legacy configs", () => {
    const byId = new Map(DEFAULT_ROUTINE_TASKS.map((t) => [t.id, t]));

    expect(getTaskVerificationMode(byId.get("routine-eggs"))).toBe("record_required");
    expect(getTaskVerificationMode(byId.get("routine-feed-am"))).toBe("record_required");
    expect(getTaskVerificationMode(byId.get("routine-daily-closure"))).toBe("record_required");
    expect(getTaskVerificationMode(byId.get("routine-weekly-biosecurity"))).toBe("record_required");
    expect(getTaskVerificationMode(byId.get("routine-weekly-weighing"))).toBe("record_required");

    expect(getTaskVerificationMode(byId.get("routine-health-walk"))).toBe("declaration_or_record");
    expect(getTaskVerificationMode(byId.get("routine-sales-cash"))).toBe("declaration_or_record");

    const legacyBiosec: RoutineTaskConfig = {
      ...byId.get("routine-weekly-biosecurity")!,
      autoDetectSource: "manual",
      actionLabel: "Abrir bioseguridad",
    };
    expect(getEffectiveAutoDetectSource(legacyBiosec)).toBe("biosecurity_log");
    expect(getTaskVerificationMode(legacyBiosec)).toBe("record_required");
    expect(normalizeRoutineTaskConfig(legacyBiosec).autoDetectSource).toBe("biosecurity_log");

    const legacyWeighing: RoutineTaskConfig = {
      ...byId.get("routine-weekly-weighing")!,
      autoDetectSource: "manual",
      actionHref: "/dashboard/produccion?tab=animales",
      actionLabel: "Ver lotes",
    };
    const normalizedWeighing = normalizeRoutineTaskConfig(legacyWeighing);
    expect(normalizedWeighing.autoDetectSource).toBe("weight_records");
    expect(normalizedWeighing.actionHref).toBe("/dashboard/produccion/peso?nuevo=1");
    expect(normalizedWeighing.actionLabel).toBe("Registrar pesaje");
    expect(getTaskVerificationMode(normalizedWeighing)).toBe("record_required");

    const customTask: RoutineTaskConfig = {
      id: "routine-custom-1",
      title: "Limpiar mallas",
      description: "Revisión física semanal",
      module: "mantenimiento",
      shift: "manana",
      frequency: "dias_semana",
      daysOfWeek: [3],
      enabled: true,
      autoDetectSource: "manual",
      actionHref: "/dashboard",
      actionLabel: "Revisar",
      icon: "wrench",
    };
    expect(getTaskVerificationMode(customTask)).toBe("evidence_required");
    expect(getTaskVerificationMode(null)).toBe("record_required");
  });
});

