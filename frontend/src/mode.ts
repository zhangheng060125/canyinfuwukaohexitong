import sourceUrl from "../../docs/百花里餐饮部员工培训计划书.docx?url";
import type { State } from "./types";
export const TRIAL = import.meta.env.VITE_TRIAL_MODE === "1";
export const blobUrls = new Map<number, string>();
export const assetUrl = (id: number, download = false) =>
  TRIAL
    ? blobUrls.get(id) || ""
    : "/api/files/" + id + (download ? "?download=true" : "");
export const sourceHref = TRIAL ? sourceUrl : "/api/source";
let reportObjectUrl = "";
export function reportHref(data: State, start: string, end: string) {
  if (!TRIAL) return `/api/reports/export?start=${start}&end=${end}`;
  const safe = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      "考核日期",
      "员工",
      "岗位",
      "摆台计时 /20",
      "卫生抽查 /20",
      "服务流程 /20",
      "现场观察 /30",
      "口述 /10",
      "总分 /100",
      "结果",
      "红线记录",
      "考核人",
      "反馈",
      "附件数量",
    ],
  ];
  for (const a of data.assessments
    .filter((a) => a.assessed_on >= start && a.assessed_on <= end)
    .sort(
      (a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id,
    )) {
    const e = data.employees.find((e) => e.id === a.employee_id);
    rows.push([
      a.assessed_on,
      e?.name,
      e?.position,
      ...["table", "hygiene", "service", "observation", "oral"].map(
        (k) => a.scores[k],
      ),
      a.total,
      a.total >= 80 ? "合格" : "需二次培训",
      a.redlines.length ? "有" : "无",
      a.assessor,
      a.notes,
      a.evidence.length,
    ]);
  }
  if (reportObjectUrl) URL.revokeObjectURL(reportObjectUrl);
  reportObjectUrl = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((row) => row.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  return reportObjectUrl;
}
