import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import {
  Plus,
  Check,
  ChevronRight,
  Clock,
  AlertCircle,
  ShieldAlert,
  Paperclip,
  ArrowRight,
  Star,
  CheckCircle2,
  MessageSquare,
  Download,
  Flag,
  Users,
  KeyRound,
  LogIn,
  Leaf,
  LoaderCircle,
} from "lucide-react";
import { useApp } from "./context";
import {
  Attachments,
  Avatar,
  Badge,
  Empty,
  Field,
  SaveButton,
  UploadPicker,
} from "./components";
import { api, post, fmtDate, dateAdd } from "./api";
import { completedCourses, latest, employeeName, statusNames } from "./metrics";
import type {
  Assessment,
  Employee,
  Training,
  Directive,
  Course,
  Followup,
  Complaint,
  Role,
  User,
} from "./types";

function useSave() {
  const { refresh, toast, close } = useApp();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    save: async (
      path: string,
      body: any,
      message = "记录已保存",
      leave = true,
    ) => {
      if (busy) return;
      setBusy(true);
      try {
        const result = await post(path, body);
        await refresh();
        toast(message);
        if (leave) close();
        return result;
      } catch (e) {
        toast((e as Error).message, true);
      } finally {
        setBusy(false);
      }
    },
  };
}
function Actions({
  busy,
  label = "保存记录",
  children,
}: {
  busy: boolean;
  label?: string;
  children?: ReactNode;
}) {
  const { close } = useApp();
  return (
    <div className="form-actions">
      <span>{children}</span>
      <button type="button" className="btn" onClick={close}>
        取消
      </button>
      <SaveButton busy={busy}>{label}</SaveButton>
    </div>
  );
}
function EmployeeSelect({
  value,
  onChange,
  all = false,
  "aria-labelledby": labelledBy,
}: {
  value: string;
  onChange: (s: string) => void;
  all?: boolean;
  "aria-labelledby"?: string;
}) {
  const { data } = useApp();
  return (
    <select
      required={!all}
      aria-labelledby={labelledBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{all ? "全体前厅员工" : "请选择员工"}</option>
      {data.employees
        .filter((e) => e.active)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.position}
          </option>
        ))}
    </select>
  );
}
export function EmployeeForm() {
  const { data } = useApp();
  const { save, busy } = useSave();
  const [form, setForm] = useState({
    name: "",
    position: "服务员",
    group_name: "前厅",
    joined: data.today,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save("/employees", form, "员工已添加");
      }}
    >
      <div className="form-grid">
        {[
          ["name", "员工姓名"],
          ["position", "岗位"],
          ["group_name", "所属班组"],
          ["joined", "入职日期"],
        ].map(([k, t]) => (
          <Field label={t + " *"} key={k}>
            <input
              required
              type={k === "joined" ? "date" : "text"}
              max={k === "joined" ? data.today : undefined}
              maxLength={40}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              placeholder={k === "name" ? "请输入真实姓名" : undefined}
            />
          </Field>
        ))}
      </div>
      <div className="alert neutral">
        <Users size={18} />
        <p>员工档案与登录账号分别管理。添加员工不会自动创建登录账号。</p>
      </div>
      <Actions busy={busy} label="添加员工" />
    </form>
  );
}

export function AssessmentForm({
  initial,
}: {
  initial?: { employee_id?: number };
}) {
  const { data, standards } = useApp();
  const { save, busy } = useSave();
  const [emp, setEmp] = useState(String(initial?.employee_id || ""));
  const [day, setDay] = useState(data.today);
  const [course, setCourse] = useState("all");
  const [scores, setScores] = useState<Record<string, string>>({
    table: "",
    hygiene: "",
    service: "",
    observation: "",
    oral: "",
  });
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<number[]>([]);
  const [duration, setDuration] = useState("");
  const [redlines, setRedlines] = useState<string[]>([]);
  const [showChecks, setShowChecks] = useState(false);
  const total = +Object.values(scores)
    .reduce((s, v) => s + (+v || 0), 0)
    .toFixed(1);
  const filled = Object.values(scores).every((v) => v !== "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          "/assessments",
          {
            employee_id: +emp,
            assessed_on: day,
            course,
            scores: Object.fromEntries(
              Object.entries(scores).map(([k, v]) => [k, +v]),
            ),
            checks,
            notes,
            evidence,
            duration: duration ? +duration : null,
            redlines,
          },
          total >= 80
            ? "考核已保存，继续两周跟岗"
            : "考核已保存，请安排针对性二次培训",
        );
      }}
    >
      <div className="form-grid">
        <Field label="考核员工 *">
          <EmployeeSelect value={emp} onChange={setEmp} />
        </Field>
        <Field label="考核日期 *">
          <input
            type="date"
            required
            max={data.today}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <Field label="重点观察课程">
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="all">综合考核 · 五门课程</option>
            {standards.courses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="摆台实测用时（秒）"
          hint="原文未设合格时限；请依据餐厅 SOP 人工评价。"
        >
          <input
            type="number"
            min={0}
            max={86400}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="选填，如 210"
          />
        </Field>
      </div>
      <div className="form-section-title">
        <span>01</span>
        <h3>三项考核 · 五个评分维度</h3>
        <Badge tone="gray">不设笔试</Badge>
      </div>
      <div className="scoring-layout">
        <div className="scoring-parts">
          {standards.parts.map((p) => (
            <label className="scoring-row" key={p.key}>
              <div>
                <strong>
                  {p.name}
                  <span>{p.group}</span>
                </strong>
                <small>{p.hint}</small>
              </div>
              <div className="number-score">
                <input
                  aria-label={p.name + "得分"}
                  type="number"
                  min={0}
                  max={p.max}
                  step={0.1}
                  required
                  value={scores[p.key]}
                  onChange={(e) =>
                    setScores({ ...scores, [p.key]: e.target.value })
                  }
                  placeholder="—"
                />
                <span>/ {p.max}</span>
              </div>
            </label>
          ))}
        </div>
        <div
          className={"score-summary " + (filled && total < 80 ? "warning" : "")}
        >
          <span>本次综合得分</span>
          <strong>
            {filled ? total : "—"}
            <small>/ 100</small>
          </strong>
          <Badge tone={filled ? (total < 80 ? "amber" : "green") : "gray"}>
            {filled ? (total < 80 ? "需二次培训" : "已达标") : "待完成评分"}
          </Badge>
          <p>
            实操 60 + 观察 30 + 口述 10
            <br />
            合格线 80 分，不设淘汰
          </p>
          {redlines.length > 0 && (
            <span className="text-red small">红线事件另行立即核查</span>
          )}
        </div>
      </div>
      <div className="alert neutral small">
        <AlertCircle size={17} />
        <p>
          计划书未规定逐项扣分细则；分值由考核人评价，请在反馈中写明依据。检查点的选择不会自动换算分数。
        </p>
      </div>
      <button
        className="checklist-toggle"
        type="button"
        onClick={() => setShowChecks(!showChecks)}
      >
        <span>
          <ClipboardIcon />
          逐项检查记录{" "}
          <small>
            {Object.values(checks).filter((v) => v !== "unchecked").length}{" "}
            项已检查
          </small>
        </span>
        <ChevronRight
          size={17}
          style={{ transform: showChecks ? "rotate(90deg)" : "" }}
        />
      </button>
      {showChecks && (
        <div className="assessment-checklists">
          {standards.courses
            .filter((c) => course === "all" || c.id === course)
            .map((c) => (
              <div className="check-group" key={c.id}>
                <h4>{c.name}</h4>
                {c.items.map(([name, standard, method], i) => (
                  <div className="check-row" key={i}>
                    <div>
                      <strong>{name}</strong>
                      <p>{standard}</p>
                      <small>检查：{method}</small>
                    </div>
                    <select
                      aria-label={name + "检查结果"}
                      value={checks[c.id + ":" + i] || "unchecked"}
                      onChange={(e) =>
                        setChecks({
                          ...checks,
                          [c.id + ":" + i]: e.target.value,
                        })
                      }
                    >
                      <option value="unchecked">未检查</option>
                      <option value="pass">达标</option>
                      <option value="improve">需改善</option>
                    </select>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
      <div className="form-section-title">
        <span>02</span>
        <h3>观察反馈与考核留痕</h3>
      </div>
      <Field label="表现、问题与扣分依据 *">
        <textarea
          required
          maxLength={4000}
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="具体记录做得好的动作、需要纠正的问题，以及接下来的训练安排。"
        />
      </Field>
      <div className="redline-checks">
        <strong>
          <ShieldAlert size={16} />{" "}
          红线事件（如发生则勾选，将自动生成紧急核查指令）
        </strong>
        {[
          ["sick", "发现带病上岗"],
          ["privacy", "发现突发事件围观、拍照或传播"],
        ].map(([v, t]) => (
          <label key={v}>
            <input
              type="checkbox"
              checked={redlines.includes(v)}
              onChange={(e) =>
                setRedlines(
                  e.target.checked
                    ? [...redlines, v]
                    : redlines.filter((r) => r !== v),
                )
              }
            />
            {t}
          </label>
        ))}
      </div>
      <label className="field">
        <span>考核附件（选填）</span>
      </label>
      <UploadPicker
        value={evidence}
        onChange={setEvidence}
        category="实操照片"
      />
      <Actions busy={busy} label="提交考核">
        {filled && <strong>合计 {total} 分</strong>}
      </Actions>
    </form>
  );
}
function ClipboardIcon() {
  return <CheckCircle2 size={17} />;
}

export function AssessmentDetail({ record: a }: { record: Assessment }) {
  const { data, standards, user, open } = useApp();
  return (
    <>
      <div className="assessment-summary">
        <Avatar name={employeeName(data, a.employee_id)} size="lg" />
        <div>
          <h2>{employeeName(data, a.employee_id)}</h2>
          <p>
            {fmtDate(a.assessed_on)} · {a.assessor} 考核
          </p>
          <Badge tone={a.total < 80 ? "amber" : "green"}>
            {a.total < 80 ? "需二次培训" : "已达标"}
          </Badge>
        </div>
        <span className={"big-score " + (a.total < 80 ? "low" : "")}>
          {a.total}
          <small>/ 100</small>
        </span>
      </div>
      <div className="detail-scores">
        {standards.parts.map((p) => (
          <div key={p.key}>
            <span>{p.name}</span>
            <strong>
              {a.scores[p.key]}
              <small>/ {p.max}</small>
            </strong>
            <div className="track">
              <i style={{ width: (a.scores[p.key] / p.max) * 100 + "%" }} />
            </div>
          </div>
        ))}
      </div>
      {a.duration !== null && (
        <p className="detail-line">
          <Clock size={16} />
          摆台实测用时：{a.duration} 秒（具体时限以餐厅 SOP 为准）
        </p>
      )}
      <h3 className="detail-heading">观察与反馈</h3>
      <div className="text-box">{a.notes}</div>
      {a.redlines.length > 0 && (
        <div className="alert red">
          <ShieldAlert size={18} />
          <p>
            已记录红线事件并生成紧急核查指令：
            {a.redlines
              .map((r) => (r === "sick" ? "带病上岗" : "突发事件纪律"))
              .join("、")}
            。总分不替代红线事件处置。
          </p>
        </div>
      )}
      <h3 className="detail-heading">逐项检查</h3>
      {Object.entries(a.checks).filter(([, v]) => v !== "unchecked").length ? (
        <div className="detail-checks">
          {Object.entries(a.checks)
            .filter(([, v]) => v !== "unchecked")
            .map(([key, value]) => {
              const [id, index] = key.split(":");
              const c = standards.courses.find((c) => c.id === id);
              return (
                <div key={key}>
                  <span>
                    {c?.name} · {c?.items[+index]?.[0]}
                  </span>
                  <Badge tone={value === "pass" ? "green" : "amber"}>
                    {value === "pass" ? "达标" : "需改善"}
                  </Badge>
                </div>
              );
            })}
        </div>
      ) : (
        <p className="muted small">
          本次未录入逐项检查，不代表所有检查点已通过。
        </p>
      )}
      <h3 className="detail-heading">考核附件 · {a.evidence.length} 份</h3>
      {a.evidence.length ? (
        <Attachments ids={a.evidence} />
      ) : (
        <p className="muted small">未附文件</p>
      )}
      <div className="form-actions">
        <span className="muted small">提交后保留原始记录，复训需新建考核</span>
        {user.role === "owner" || user.role === "manager" ? (
          <button
            className="btn primary"
            onClick={() =>
              open({ type: "directive", data: { employee_id: a.employee_id } })
            }
          >
            <Flag size={16} />
            下达指令
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={() =>
              open({
                type: "training",
                data: {
                  course: a.course === "all" ? "service" : a.course,
                  employee_id: a.employee_id,
                },
              })
            }
          >
            <Plus size={16} />
            安排针对性培训
          </button>
        )}
      </div>
    </>
  );
}

export function TrainingForm({
  initial,
}: {
  initial?: { course?: string; employee_id?: number };
}) {
  const { data, standards } = useApp();
  const { save, busy } = useSave();
  const [course, setCourse] = useState(initial?.course || "hygiene");
  const c = standards.courses.find((c) => c.id === course)!;
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(data.today);
  const [time, setTime] = useState("14:30");
  const [mins, setMins] = useState(c.minutes);
  const [method, setMethod] = useState("先示范 → 学员实操 → 单动作纠正");
  const [status, setStatus] = useState("planned");
  const [attendees, setAttendees] = useState<number[]>(
    initial?.employee_id
      ? [initial.employee_id]
      : data.employees.filter((e) => e.active).map((e) => e.id),
  );
  const [present, setPresent] = useState<number[]>([]);
  const [issues, setIssues] = useState("");
  const [evidence, setEvidence] = useState<number[]>([]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          "/trainings",
          {
            title: title || c.name + " · 实操带教",
            course,
            scheduled_on: day,
            time,
            minutes: mins,
            method,
            status,
            attendees,
            present,
            issues,
            evidence,
          },
          "培训计划已保存",
        );
      }}
    >
      <div className="form-grid">
        <Field label="课程 *">
          <select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setMins(
                standards.courses.find((c) => c.id === e.target.value)!.minutes,
              );
            }}
          >
            {standards.courses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="培训主题">
          <input
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={c.name + " · 实操带教"}
          />
        </Field>
        <Field label="培训日期 *">
          <input
            type="date"
            required
            value={day}
            max={status === "completed" ? data.today : undefined}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <Field label="非高峰时间 *">
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="时长（分钟） *">
          <input
            type="number"
            min={1}
            max={480}
            required
            value={mins}
            onChange={(e) => setMins(+e.target.value)}
          />
        </Field>
        <Field label="记录状态">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="planned">待开展 · 仅安排计划</option>
            <option value="completed">已完成 · 同时登记签到</option>
          </select>
        </Field>
        <Field label="教学方法 *" full>
          <input
            required
            value={method}
            maxLength={400}
            onChange={(e) => setMethod(e.target.value)}
          />
        </Field>
      </div>
      <div className="standard-goal compact">
        <span>本课目标</span>
        <strong>{c.goal}</strong>
        <p>{c.method}</p>
      </div>
      <h3 className="detail-heading">参训名单 *</h3>
      <div className="attendee-select">
        {data.employees
          .filter((e) => e.active)
          .map((e) => (
            <label key={e.id}>
              <input
                type="checkbox"
                checked={attendees.includes(e.id)}
                onChange={(ev) => {
                  setAttendees(
                    ev.target.checked
                      ? [...attendees, e.id]
                      : attendees.filter((id) => id !== e.id),
                  );
                  if (!ev.target.checked)
                    setPresent(present.filter((id) => id !== e.id));
                }}
              />
              <Avatar name={e.name} size="xs" />
              {e.name}
            </label>
          ))}
      </div>
      {!attendees.length && (
        <p className="text-amber small">至少选择一位参训员工</p>
      )}
      {status === "completed" && (
        <>
          <h3 className="detail-heading">实际签到（仅勾选到场员工）</h3>
          <Attendance
            attendees={attendees}
            value={present}
            onChange={setPresent}
          />
          <Field label="当次问题清单 *">
            <textarea
              rows={3}
              required
              value={issues}
              maxLength={4000}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="具体记录未掌握的动作；如无问题，写明未发现问题。"
            />
          </Field>
        </>
      )}
      <h3 className="detail-heading">培训留痕</h3>
      <p className="muted small">
        每次培训留三样：签到表、实操照片、问题清单。可上传照片、表格或补充教学材料。
      </p>
      <UploadPicker
        value={evidence}
        onChange={setEvidence}
        category="培训资料"
      />
      <Actions busy={busy} label="保存培训计划" />
    </form>
  );
}
function Attendance({
  attendees,
  value,
  onChange,
}: {
  attendees: number[];
  value: number[];
  onChange: (n: number[]) => void;
}) {
  const { data } = useApp();
  return (
    <div className="attendance">
      {attendees.map((id) => (
        <label key={id}>
          <input
            type="checkbox"
            checked={value.includes(id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, id]
                  : value.filter((v) => v !== id),
              )
            }
          />
          <span>{employeeName(data, id)}</span>
          <small>{value.includes(id) ? "已到场" : "未签到"}</small>
        </label>
      ))}
    </div>
  );
}
export function TrainingDetail({ training: t }: { training: Training }) {
  const { data, user, standards } = useApp();
  const { save, busy } = useSave();
  const [present, setPresent] = useState<number[]>(t.present);
  const [issues, setIssues] = useState(t.issues);
  const [evidence, setEvidence] = useState(t.evidence);
  const planned = t.status === "planned";
  return (
    <>
      <div className="training-detail-top">
        <Badge tone={planned ? "blue" : "green"}>
          {planned ? "待开展" : "已完成"}
        </Badge>
        <h2>{t.title}</h2>
        <p>
          {fmtDate(t.scheduled_on)} {t.time} · {t.minutes} 分钟 · {t.creator}
        </p>
      </div>
      <div className="text-box">
        <strong>教学方法</strong>
        <p>{t.method}</p>
        <strong>达标标准</strong>
        <p>{standards.courses.find((c) => c.id === t.course)?.goal}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(
            `/trainings/${t.id}/complete`,
            { present, issues, evidence },
            "已记录签到与培训结果",
          );
        }}
      >
        <h3 className="detail-heading">
          签到名单 · {t.present.length} / {t.attendees.length} 人
        </h3>
        {planned && user.role !== "owner" ? (
          <Attendance
            attendees={t.attendees}
            value={present}
            onChange={setPresent}
          />
        ) : (
          <div className="attendance readonly">
            {t.attendees.map((id) => (
              <div key={id}>
                <Avatar name={employeeName(data, id)} size="xs" />
                <span>{employeeName(data, id)}</span>
                <Badge tone={t.present.includes(id) ? "green" : "gray"}>
                  {t.present.includes(id) ? "已签到" : "未签到"}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <h3 className="detail-heading">当次问题清单</h3>
        {planned && user.role !== "owner" ? (
          <textarea
            required
            maxLength={4000}
            rows={4}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="填写实操问题与下一步纠正动作；无问题请写明未发现问题"
          />
        ) : (
          <div className="text-box">{t.issues || "尚未录入"}</div>
        )}
        <h3 className="detail-heading">培训留痕</h3>
        {planned && user.role !== "owner" ? (
          <UploadPicker value={evidence} onChange={setEvidence} />
        ) : (
          <>
            <Attachments ids={t.evidence} />
            {!t.evidence.some((id) =>
              data.files.find((f) => f.id === id)?.mime.startsWith("image/"),
            ) && (
              <div className="alert amber">
                <AlertCircle size={17} />
                <p>本次未附实操照片，培训留痕尚不完整。</p>
              </div>
            )}
          </>
        )}
        {planned && user.role !== "owner" && (
          <Actions busy={busy} label="确认签到并完成培训" />
        )}
      </form>
    </>
  );
}

export function DirectiveForm({
  initial,
}: {
  initial?: { employee_id?: number };
}) {
  const { data } = useApp();
  const { save, busy } = useSave();
  const [emp, setEmp] = useState(String(initial?.employee_id || ""));
  const [form, setForm] = useState({
    title: "",
    detail: "",
    due: dateAdd(data.today, 2),
    priority: "normal",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          "/directives",
          { ...form, employee_id: emp ? +emp : null },
          "管理指令已下达",
        );
      }}
    >
      <div className="form-grid">
        <Field label="跟进对象">
          <EmployeeSelect value={emp} onChange={setEmp} all />
        </Field>
        <Field label="完成期限 *">
          <input
            required
            type="date"
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
          />
        </Field>
        <Field label="指令标题 *" full>
          <input
            required
            maxLength={100}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="例如：加强巡台与主动加水训练"
          />
        </Field>
        <Field label="执行要求与验收标准 *" full>
          <textarea
            required
            rows={5}
            maxLength={4000}
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="明确需要纠正什么动作、何时完成、提交什么证据，以及如何验收。"
          />
        </Field>
        <Field label="优先级">
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="normal">常规跟进</option>
            <option value="high">重点 / 紧急</option>
          </select>
        </Field>
      </div>
      <div className="alert neutral">
        <Flag size={17} />
        <p>
          培训专员执行并提交反馈，管理层复核通过后关闭，所有状态与反馈保留记录。
        </p>
      </div>
      <Actions busy={busy} label="下达指令" />
    </form>
  );
}

export function DirectiveDetail({
  directive: initial,
}: {
  directive: Directive;
}) {
  const { data, user } = useApp();
  const { save, busy } = useSave();
  const d = data.directives.find((d) => d.id === initial.id) || initial;
  const comments = data.comments
    .filter((c) => c.directive_id === d.id)
    .sort((a, b) => a.id - b.id);
  const [body, setBody] = useState("");
  const [evidence, setEvidence] = useState<number[]>([]);
  const [transition, setTransition] = useState("");
  const manager = user.role !== "trainer";
  const options =
    d.status === "open" && user.role !== "owner"
      ? [["in_progress", "开始执行"]]
      : d.status === "in_progress" && user.role !== "owner"
        ? [["submitted", "提交管理层复核"]]
        : d.status === "submitted" && manager
          ? [
              ["closed", "验收通过 · 关闭指令"],
              ["in_progress", "退回继续整改"],
            ]
          : [];
  return (
    <>
      <div className="directive-detail-heading">
        <Badge tone={d.status === "closed" ? "green" : "amber"}>
          {statusNames[d.status]}
        </Badge>
        <h2>{d.title}</h2>
        <p>
          {d.author} 下达 · {employeeName(data, d.employee_id)} ·{" "}
          {fmtDate(d.due)} 截止
        </p>
      </div>
      <div className="text-box">{d.detail}</div>
      <h3 className="detail-heading">执行与反馈记录</h3>
      <div className="comment-timeline">
        <div>
          <span className="timeline-dot" />
          <div>
            <strong>
              {d.author} <small>下达指令</small>
            </strong>
            <p>{d.created.slice(0, 16).replace("T", " ")}</p>
          </div>
        </div>
        {comments.map((c) => (
          <div key={c.id}>
            <span className="timeline-dot" />
            <div>
              <strong>
                {c.author}
                <small>{c.created.slice(0, 16).replace("T", " ")}</small>
              </strong>
              <p className="comment-body">{c.body}</p>
              {c.transition && (
                <Badge tone={c.transition === "closed" ? "green" : "blue"}>
                  状态更新：{statusNames[c.transition]}
                </Badge>
              )}
              <Attachments ids={c.evidence} />
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await save(
            `/directives/${d.id}/comments`,
            { body, evidence, transition: transition || null },
            transition ? "反馈与状态已更新" : "反馈已保存",
            false,
          );
          if (ok) {
            setBody("");
            setEvidence([]);
            setTransition("");
          }
        }}
      >
        <fieldset disabled={busy} className="form-fieldset">
        <h3 className="detail-heading">
          {d.status === "closed" ? "补充意见" : "添加反馈 / 处理意见"}
        </h3>
        <textarea
          required
          rows={3}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="具体说明已完成的训练、观察到的改变，或管理层意见…"
        />
        {options.length > 0 && (
          <Field label="同时更新执行状态">
            <select
              value={transition}
              onChange={(e) => setTransition(e.target.value)}
            >
              <option value="">仅记录意见，不变更状态</option>
              {options.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        )}
        <UploadPicker
          value={evidence}
          onChange={setEvidence}
          category="整改证据"
        />
        <Actions
          busy={busy}
          label={
            transition
              ? options.find(([v]) => v === transition)?.[1]
              : "提交反馈"
          }
        />
        </fieldset>
      </form>
    </>
  );
}

export function FollowupForm({
  initial,
}: {
  initial?: { employee_id?: number; recorded_on?: string };
}) {
  const { data } = useApp();
  const { save, busy } = useSave();
  const [emp, setEmp] = useState(String(initial?.employee_id || ""));
  const [date, setDate] = useState(initial?.recorded_on || data.today);
  const [encouragement, setEncouragement] = useState("");
  const [correction, setCorrection] = useState("");
  const [evidence, setEvidence] = useState<number[]>([]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          "/followups",
          {
            employee_id: +emp,
            recorded_on: date,
            encouragement,
            correction,
            evidence,
          },
          "每日跟岗记录已保存",
        );
      }}
    >
      <div className="form-grid">
        <Field label="跟岗员工 *">
          <EmployeeSelect value={emp} onChange={setEmp} />
        </Field>
        <Field label="记录日期 *">
          <input
            required
            type="date"
            value={date}
            max={data.today}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="alert neutral">
        <Leaf size={18} />
        <p>每天鼓励与纠正。一次只改一到两个动作，先示范、再让员工做一遍。</p>
      </div>
      <Field label="今天值得鼓励的进步 *">
        <textarea
          required
          rows={3}
          maxLength={2000}
          value={encouragement}
          onChange={(e) => setEncouragement(e.target.value)}
          placeholder="具体到一个做得好的动作…"
        />
      </Field>
      <Field label="需要纠正的动作与带教建议 *">
        <textarea
          required
          rows={3}
          maxLength={2000}
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder="例如：客区不小跑；示范遇客侧身，让学员再走一遍。"
        />
      </Field>
      <UploadPicker value={evidence} onChange={setEvidence} />
      <Actions busy={busy} label="保存今日跟岗" />
    </form>
  );
}
export function FollowupDetail({ record: f }: { record: Followup }) {
  const { data } = useApp();
  return (
    <>
      <div className="assessment-summary">
        <Avatar name={employeeName(data, f.employee_id)} size="lg" />
        <div>
          <h2>{employeeName(data, f.employee_id)}</h2>
          <p>
            {fmtDate(f.recorded_on)} · {f.author} 跟岗
          </p>
        </div>
      </div>
      <h3 className="detail-heading">
        <Star size={17} />
        值得鼓励
      </h3>
      <div className="text-box">{f.encouragement}</div>
      <h3 className="detail-heading">
        <Flag size={17} />
        纠正与建议
      </h3>
      <div className="text-box">{f.correction}</div>
      <Attachments ids={f.evidence} />
    </>
  );
}

export function EmployeeDetail({ employee: e }: { employee: Employee }) {
  const { data, standards, user, open, toast, refresh } = useApp();
  const [tab, setTab] = useState("scores");
  const [archiving, setArchiving] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const current = data.employees.find((x) => x.id === e.id) || e;
  const a = latest(data, e.id);
  const scores = data.assessments
    .filter((a) => a.employee_id === e.id)
    .sort((a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id);
  const follows = data.followups.filter((f) => f.employee_id === e.id);
  return (
    <>
      <div className="employee-profile">
        <Avatar name={e.name} size="xl" index={e.id} />
        <div>
          <h2>
            {e.name}
            <Badge tone={current.active ? "green" : "gray"}>
              {current.active ? "在训" : "已停用"}
            </Badge>
          </h2>
          <p>
            {e.position} · {e.group_name} · {fmtDate(e.joined)} 入职
          </p>
        </div>
        <div>
          <strong className={"big-score " + (a && a.total < 80 ? "low" : "")}>
            {a?.total ?? "—"}
            <small>/ 100</small>
          </strong>
          <p>最新考核</p>
        </div>
      </div>
      <div className="profile-courses">
        {standards.courses.map((c) => {
          const done = data.trainings.some(
            (t) =>
              t.course === c.id &&
              t.status === "completed" &&
              t.present.includes(e.id),
          );
          return (
            <button
              key={c.id}
              className={done ? "done" : ""}
              onClick={() => open({ type: "course", data: c })}
            >
              {done ? <CheckCircle2 size={19} /> : <span>0{c.day}</span>}
              <small>{c.name}</small>
            </button>
          );
        })}
      </div>
      <div className="toolbar profile-toolbar">
        <div className="tabs">
          <button
            className={tab === "scores" ? "active" : ""}
            onClick={() => setTab("scores")}
          >
            考核记录 <span>{scores.length}</span>
          </button>
          <button
            className={tab === "daily" ? "active" : ""}
            onClick={() => setTab("daily")}
          >
            跟岗记录 <span>{follows.length}</span>
          </button>
        </div>
      </div>
      {tab === "scores" ? (
        <div className="profile-records">
          {scores.length ? (
            scores.map((a) => (
              <button
                key={a.id}
                onClick={() => open({ type: "assessmentDetail", data: a })}
              >
                <span className={"score " + (a.total < 80 ? "low" : "")}>
                  {a.total}
                  <small>分</small>
                </span>
                <div>
                  <strong>
                    {fmtDate(a.assessed_on)} · {a.assessor}
                  </strong>
                  <p>{a.notes}</p>
                </div>
                <Badge tone={a.total < 80 ? "amber" : "green"}>
                  {a.total < 80 ? "需复训" : "达标"}
                </Badge>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <Empty title="尚未提交考核" />
          )}
        </div>
      ) : (
        <div className="profile-records">
          {follows.length ? (
            follows.map((f) => (
              <button
                key={f.id}
                onClick={() => open({ type: "followupDetail", data: f })}
              >
                <span className="daily-icon">
                  <Leaf size={20} />
                </span>
                <div>
                  <strong>
                    {fmtDate(f.recorded_on)} · {f.author}
                  </strong>
                  <p>{f.encouragement}</p>
                  <p className="muted">纠正：{f.correction}</p>
                </div>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <Empty title="暂无跟岗记录" />
          )}
        </div>
      )}
      <div className="form-actions">
        {user.role !== "trainer" && (
          <button
            className="text-button"
            onClick={() => setArchiving(!archiving)}
          >
            {current.active ? "停用员工" : "恢复员工"}
          </button>
        )}
        <span />
        {user.role !== "owner" && current.active ? (
          <>
            <button
              className="btn"
              onClick={() =>
                open({ type: "followup", data: { employee_id: e.id } })
              }
            >
              记录跟岗
            </button>
            <button
              className="btn primary"
              onClick={() =>
                open({ type: "assessment", data: { employee_id: e.id } })
              }
            >
              <Plus size={16} />
              新建考核
            </button>
          </>
        ) : (
          <button
            className="btn primary"
            onClick={() =>
              open({ type: "directive", data: { employee_id: e.id } })
            }
          >
            <Flag size={16} />
            下达指令
          </button>
        )}
      </div>
      {archiving && (
        <div className="alert amber archive-confirm">
          <p>
            {current.active
              ? "停用后保留全部历史档案，并从在训统计移出。确认停用？"
              : "确认恢复为在训员工？"}
          </p>
          <button
            className="btn"
            disabled={archiveBusy}
            onClick={async () => {
              setArchiveBusy(true);
              try {
                await api(`/employees/${e.id}/archive`, { method: "PATCH" });
                await refresh();
                setArchiving(false);
                toast("员工状态已更新");
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setArchiveBusy(false);
              }
            }}
          >
            确认{current.active ? "停用" : "恢复"}
          </button>
        </div>
      )}
    </>
  );
}

export function UploadForm() {
  const { close } = useApp();
  const [ids, setIds] = useState<number[]>([]);
  const [category, setCategory] = useState("培训资料");
  return (
    <>
      <Field label="资料分类">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {[
            "培训资料",
            "实操照片",
            "实操视频",
            "签到表",
            "问题清单",
            "摆台 SOP",
            "整改证据",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <UploadPicker value={ids} onChange={setIds} category={category} />
      <div className="alert neutral">
        <Paperclip size={17} />
        <p>
          上传成功即保存到资料库。在培训或考核表单中可通过“从已有资料库选择”关联这些文件。
        </p>
      </div>
      <div className="form-actions">
        <span>
          {ids.length ? `本次已选择 ${ids.length} 份文件` : "支持多文件上传"}
        </span>
        <button className="btn primary" onClick={close}>
          <Check size={16} />
          完成
        </button>
      </div>
    </>
  );
}
export function CourseDetail({ course: c }: { course: Course }) {
  return (
    <>
      <div className="standard-title">
        <div>
          <span className="eyebrow">LESSON 0{c.day}</span>
          <h2>{c.name}</h2>
        </div>
        <Badge>{c.minutes} 分钟</Badge>
      </div>
      <div className="standard-goal">
        <span>达标标准</span>
        <strong>{c.goal}</strong>
        <p>{c.method}</p>
      </div>
      {c.redline && (
        <div className="alert red">
          <ShieldAlert size={18} />
          <p>{c.redline}</p>
        </div>
      )}
      {c.missing && (
        <div className="alert amber">
          <AlertCircle size={18} />
          <p>{c.missing}</p>
        </div>
      )}
      <div className="check-group">
        {c.items.map(([item, standard, method]) => (
          <div className="check-row" key={item}>
            <div>
              <strong>{item}</strong>
              <p>{standard}</p>
              <small>检查方式：{method}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ComplaintForm() {
  const { data } = useApp();
  const { save, busy } = useSave();
  const [emp, setEmp] = useState("");
  const [form, setForm] = useState({
    occurred_on: data.today,
    summary: "",
    heard: "",
    restated: "",
    solution: "",
    deadline: "",
    amount: 0,
    reported_to: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          "/complaints",
          { ...form, employee_id: +emp },
          "客诉已登记" + (form.amount > 50 ? "，待经理审批" : ""),
        );
      }}
    >
      <div className="alert red">
        <ShieldAlert size={18} />
        <p>
          不围观、不拍照、不发朋友圈。本登记只记录必要处理事实，不收集客人姓名、联系方式或现场影像。
        </p>
      </div>
      <div className="form-grid">
        <Field label="当班员工 *">
          <EmployeeSelect value={emp} onChange={setEmp} />
        </Field>
        <Field label="发生日期 *">
          <input
            type="date"
            required
            max={data.today}
            value={form.occurred_on}
            onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
          />
        </Field>
        <Field label="客诉 / 突发情况摘要 *" full>
          <input
            required
            value={form.summary}
            maxLength={2000}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="例如：客人反映菜品偏凉"
          />
        </Field>
        {[
          ["heard", "01 听完：客人的具体诉求"],
          ["restated", "02 复述：向客人确认的问题"],
          ["solution", "03 方案：具体处理动作"],
          ["deadline", "预计完成时间（不用“马上就好”）"],
          ["reported_to", "04 上报留痕：上报对象与记录"],
        ].map(([k, t]) => (
          <Field label={t + " *"} key={k} full>
            <textarea
              required
              maxLength={
                k === "deadline" ? 200 : k === "reported_to" ? 100 : 2000
              }
              rows={2}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </Field>
        ))}
        <Field label="处理涉及金额（元） *">
          <input
            required
            type="number"
            min={0}
            max={100000}
            step={0.01}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: +e.target.value })}
          />
        </Field>
      </div>
      {form.amount > 50 && (
        <div className="alert amber">
          <AlertCircle size={18} />
          <p>
            超过 50
            元必须经理批准。本记录将进入待审批状态，经理或管理层批准后才显示已批准。
          </p>
        </div>
      )}
      <Actions busy={busy} label="提交客诉登记" />
    </form>
  );
}
export function ComplaintDetail({ record: initial }: { record: Complaint }) {
  const { data, user } = useApp();
  const { save, busy } = useSave();
  const c = data.complaints.find((c) => c.id === initial.id) || initial;
  return (
    <>
      <Badge tone={c.status === "pending_approval" ? "amber" : "green"}>
        {c.status === "pending_approval"
          ? "待经理审批"
          : c.status === "approved"
            ? "已批准"
            : "已登记"}
      </Badge>
      <h2 className="detail-heading">{c.summary}</h2>
      <p className="muted">
        {fmtDate(c.occurred_on)} · 当班员工 {employeeName(data, c.employee_id)}{" "}
        · {c.creator} 登记
      </p>
      {[
        ["01 听完", c.heard],
        ["02 复述", c.restated],
        ["03 给方案", c.solution],
        ["处理时间", c.deadline],
        ["04 上报留痕", c.reported_to],
        ["涉及金额", "¥" + c.amount],
        ["经理审批", c.approval || "尚无审批记录"],
      ].map(([k, v]) => (
        <div key={k}>
          <h3 className="detail-heading">{k}</h3>
          <div className="text-box">{v}</div>
        </div>
      ))}
      {c.status === "pending_approval" && user.role !== "trainer" && (
        <div className="form-actions">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() =>
              save(`/complaints/${c.id}/approve`, {}, "处理方案已批准")
            }
          >
            确认批准 ¥{c.amount}
          </button>
        </div>
      )}
    </>
  );
}

export function LoginForm() {
  const { setUser, refresh, toast, close } = useApp();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/auth/status")
      .then((s) => setInitialized(s.initialized))
      .catch((e) => toast(e.message, true));
  }, []);
  if (initialized === null)
    return (
      <div className="empty">
        <LoaderCircle className="spin" />
        正在读取工作区…
      </div>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const u = await post(
            initialized ? "/auth/login" : "/auth/bootstrap",
            form,
          );
          setUser(u);
          await refresh();
          toast(initialized ? "已登录正式工作区" : "正式工作区已创建");
          close();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="login-intro">
        <span>
          <Leaf size={30} />
        </span>
        <h2>{initialized ? "欢迎回到百花里" : "建立真实的培训工作区"}</h2>
        <p>
          {initialized
            ? "使用管理员分配的账号登录，共享真实培训与考核数据。"
            : "先创建首位管理员，再为培训专员和经理分配独立账号。正式数据与演示数据完全隔离。"}
        </p>
      </div>
      {!initialized && (
        <Field label="管理员姓名 *">
          <input
            required
            autoComplete="name"
            maxLength={40}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      )}
      <Field
        label="登录账号 *"
        hint="3—50 位英文字母、数字、下划线、点或短横线"
      >
        <input
          required
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9_.\-]+"
          autoComplete="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="例如 baihuali.admin"
        />
      </Field>
      <Field label="密码 *" hint="至少 10 位，请使用独立的强密码">
        <input
          required
          type="password"
          minLength={10}
          maxLength={128}
          autoComplete={initialized ? "current-password" : "new-password"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </Field>
      <div className="form-actions">
        <SaveButton busy={busy}>
          {initialized ? "登录正式工作区" : "创建管理员并进入"}
        </SaveButton>
      </div>
    </form>
  );
}
export function Accounts() {
  const { user, toast } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "trainer",
  });
  const [busy, setBusy] = useState(false);
  const load = () =>
    api("/users")
      .then(setUsers)
      .catch((e) => toast(e.message, true));
  useEffect(() => {
    if (user.tenant === "live") load();
  }, []);
  if (user.tenant === "demo")
    return (
      <div className="alert amber">
        <AlertCircle size={18} />
        <p>请先创建或登录正式工作区。演示空间不能创建真实登录账号。</p>
      </div>
    );
  return (
    <>
      <div className="account-list">
        {users.map((u) => (
          <div key={u.id}>
            <Avatar name={u.name} size="sm" />
            <strong>{u.name}</strong>
            <span>{u.username}</span>
            <Badge tone="gray">
              {u.role === "owner"
                ? "管理层"
                : u.role === "manager"
                  ? "餐饮经理"
                  : "培训专员"}
            </Badge>
          </div>
        ))}
      </div>
      <h3 className="detail-heading">分配新账号</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await post("/users", form);
            await load();
            setForm({ username: "", name: "", password: "", role: "trainer" });
            toast("账号已创建，请通过安全渠道告知使用者");
          } catch (e) {
            toast((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="姓名 *">
            <input
              required
              maxLength={40}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="角色">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="trainer">培训专员</option>
              <option value="manager">餐饮经理</option>
              <option value="owner">管理层 / 老板</option>
            </select>
          </Field>
          <Field label="登录账号 *">
            <input
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_.\-]+"
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>
          <Field label="初始密码 *">
            <input
              required
              type="password"
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </div>
        <Actions busy={busy} label="创建账号" />
      </form>
    </>
  );
}
