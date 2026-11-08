import type { State, Assessment } from "./types";
export const latest = (data: State, eid: number): Assessment | undefined =>
  data.assessments
    .filter((a) => a.employee_id === eid)
    .sort(
      (a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id,
    )[0];
export const completedCourses = (data: State, eid: number) =>
  new Set(
    data.trainings
      .filter((t) => t.status === "completed" && t.present.includes(eid))
      .map((t) => t.course),
  ).size;
export const employeeName = (data: State, id: number | null) =>
  data.employees.find((e) => e.id === id)?.name || "全体前厅员工";
export const statusNames: Record<string, string> = {
  open: "待执行",
  in_progress: "进行中",
  submitted: "待复核",
  closed: "已完成",
};
export const scoreTone = (n?: number) =>
  n === undefined ? "gray" : n < 80 ? "amber" : "green";
export function metrics(data: State, start?: string, end?: string) {
  const employees = data.employees.filter((e) => e.active);
  const records = data.assessments.filter(
    (a) => (!start || a.assessed_on >= start) && (!end || a.assessed_on <= end),
  );
  const last = employees
    .map(
      (e) =>
        records
          .filter((a) => a.employee_id === e.id)
          .sort(
            (a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id,
          )[0],
    )
    .filter(Boolean);
  const avg = last.length
    ? +(last.reduce((s, a) => s + a.total, 0) / last.length).toFixed(1)
    : null;
  return {
    employees,
    records,
    last,
    avg,
    passed: last.filter((a) => a.total >= 80).length,
    risks: last.filter((a) => a.total < 80 || a.redlines.length),
    pending: data.directives.filter((d) => d.status !== "closed").length,
    completed: employees.reduce((s, e) => s + completedCourses(data, e.id), 0),
  };
}
