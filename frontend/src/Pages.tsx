import { TRIAL, sourceHref, assetUrl, reportHref } from "./mode";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Clock,
  Users,
  BookOpen,
  CalendarDays,
  Search,
  ShieldAlert,
  UploadCloud,
  Printer,
  Flag,
  MessageSquare,
  SlidersHorizontal,
  GraduationCap,
  LayoutGrid,
  List,
  Paperclip,
  AlertCircle,
  ExternalLink,
  Leaf,
} from "lucide-react";
import { useApp } from "./context";
import {
  Avatar,
  Badge,
  Empty,
  PageTitle,
  SearchInput,
  FileIcon,
} from "./components";
import { EmployeeTable } from "./Dashboard";
import {
  completedCourses,
  latest,
  metrics,
  employeeName,
  statusNames,
} from "./metrics";
import { api, post, fmtDate, fileSize, dateAdd, shortDate } from "./api";

export function Employees() {
  const { data, user, open } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const m = metrics(data);
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE / GROWTH RECORDS"
        title="员工成长档案"
        subtitle="从一次示范到独立完成，为每位伙伴建立完整的成长记录。"
        actions={
          <button
            className="btn primary"
            onClick={() => open({ type: "employee" })}
          >
            <Plus size={17} />
            添加员工
          </button>
        }
      />
      <div className="mini-stats">
        <div>
          <Users size={19} />
          <span>
            在训员工
            <strong>
              {m.employees.length}
              <small>人</small>
            </strong>
          </span>
        </div>
        <div>
          <CheckCircle2 size={19} />
          <span>
            已达标
            <strong>
              {m.passed}
              <small>人</small>
            </strong>
          </span>
        </div>
        <div>
          <Flag size={19} />
          <span>
            需二次培训
            <strong>
              {m.last.filter((a) => a.total < 80).length}
              <small>人</small>
            </strong>
          </span>
        </div>
        <div>
          <BookOpen size={19} />
          <span>
            待考核
            <strong>
              {m.employees.length - m.last.length}
              <small>人</small>
            </strong>
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "全部员工"],
              ["passed", "已达标"],
              ["risk", "需复训"],
              ["unassessed", "待考核"],
              ["archived", "已停用"],
            ].map(([v, t]) => (
              <button
                className={filter === v ? "active" : ""}
                key={v}
                onClick={() => setFilter(v)}
              >
                {t}
              </button>
            ))}
          </div>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="搜索员工姓名或岗位"
          />
        </div>
        <EmployeeTable search={q} filter={filter} />
      </section>
      <div className="info-note">
        <Leaf size={18} />
        <div>
          <strong>考核的目的不是筛人，是找到还没落地的动作。</strong>
          <p>未达标员工进入二次培训；达标后持续两周跟岗，每天鼓励与纠正。</p>
        </div>
      </div>
    </>
  );
}

export function Assessments() {
  const { data, user, standards, open } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState("");
  const rows = data.assessments
    .filter(
      (a) =>
        employeeName(data, a.employee_id).includes(q) &&
        (filter === "all" ||
          (filter === "passed" ? a.total >= 80 : a.total < 80)) &&
        (!day || a.assessed_on === day),
    )
    .sort((a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id);
  return (
    <>
      <PageTitle
        eyebrow="ASSESSMENT / PRACTICE FIRST"
        title="考核与评分"
        subtitle="不设笔试。用看得见的动作，检验真正学会的服务。"
        actions={
          user.role !== "owner" && (
            <button
              className="btn primary"
              onClick={() => open({ type: "assessment" })}
            >
              <Plus size={17} />
              新建考核
            </button>
          )
        }
      />
      <div className="score-rules">
        <div>
          <ClipboardCheck size={26} />
          <span>
            <strong>100 分制 · 80 分合格</strong>
            <small>未达标进行二次培训，不设淘汰</small>
          </span>
        </div>
        <div>
          <strong>
            60<small>分</small>
          </strong>
          <span>实操</span>
          <small>摆台 20 / 卫生 20 / 流程 20</small>
        </div>
        <div>
          <strong>
            30<small>分</small>
          </strong>
          <span>现场观察</span>
          <small>每日观察教学内容吸收程度</small>
        </div>
        <div>
          <strong>
            10<small>分</small>
          </strong>
          <span>口述</span>
          <small>六字口诀 / 客诉四步</small>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "全部考核"],
              ["passed", "已达标"],
              ["risk", "需二次培训"],
            ].map(([v, t]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <input
              type="date"
              aria-label="按考核日期筛选"
              value={day}
              max={data.today}
              onChange={(e) => setDay(e.target.value)}
            />
            <SearchInput value={q} onChange={setQ} placeholder="搜索员工" />
          </div>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>员工 / 考核日期</th>
                  <th>实操 / 60</th>
                  <th>观察 / 30</th>
                  <th>口述 / 10</th>
                  <th>总分</th>
                  <th>考核结果</th>
                  <th>考核人</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar
                          name={employeeName(data, a.employee_id)}
                          size="sm"
                          index={a.employee_id}
                        />
                        <span>
                          <strong>{employeeName(data, a.employee_id)}</strong>
                          <small>{fmtDate(a.assessed_on)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {a.scores.table + a.scores.hygiene + a.scores.service}
                    </td>
                    <td>{a.scores.observation}</td>
                    <td>{a.scores.oral}</td>
                    <td>
                      <strong
                        className={"score " + (a.total < 80 ? "low" : "")}
                      >
                        {a.total}
                      </strong>
                    </td>
                    <td>
                      <Badge tone={a.total < 80 ? "amber" : "green"}>
                        {a.total < 80 ? "需二次培训" : "已达标"}
                      </Badge>
                      {a.redlines.length > 0 && <Badge tone="red">红线</Badge>}
                    </td>
                    <td className="muted">{a.assessor}</td>
                    <td>
                      <button
                        className="row-action"
                        onClick={() =>
                          open({ type: "assessmentDetail", data: a })
                        }
                      >
                        查看
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="暂无考核记录"
            text="选择员工，按实操、现场观察和口述三项提交评分。"
          />
        )}
        <div className="table-footer">
          共 {rows.length} 条记录 · 成绩保留提交时的评分及考核人
        </div>
      </section>
    </>
  );
}

export function Training() {
  const { data, standards, user, open } = useApp();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const rows = data.trainings
    .filter(
      (t) => (filter === "all" || filter === t.status) && t.title.includes(q),
    )
    .sort(
      (a, b) => b.scheduled_on.localeCompare(a.scheduled_on) || b.id - a.id,
    );
  return (
    <>
      <PageTitle
        eyebrow="TRAINING / LEARN BY DOING"
        title="培训计划与记录"
        subtitle="五门课程，五天打底。先示范、再实操，一次只纠正一个动作。"
        actions={
          user.role !== "owner" && (
            <button
              className="btn primary"
              onClick={() => open({ type: "training" })}
            >
              <Plus size={17} />
              安排培训
            </button>
          )
        }
      />
      <section className="course-roadmap">
        {standards.courses.map((c, i) => (
          <button key={c.id} onClick={() => open({ type: "course", data: c })}>
            <span className="roadmap-day">
              DAY 0{c.day}
              <span>{c.minutes} min</span>
            </span>
            <div className="roadmap-number">0{i + 1}</div>
            <strong>{c.name}</strong>
            <small>{c.goal}</small>
            <span className="roadmap-line" />
          </button>
        ))}
      </section>
      <div className="section-line">
        <h3>
          培训记录 <span>{data.trainings.length}</span>
        </h3>
        <p>
          <Clock size={14} /> 培训安排在非高峰时段，临时接待可顺延
        </p>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "全部培训"],
              ["planned", "待开展"],
              ["completed", "已完成"],
            ].map(([v, t]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {t}
              </button>
            ))}
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="搜索培训主题" />
        </div>
        <div className="training-list">
          {rows.length ? (
            rows.map((t) => {
              const c = standards.courses.find((c) => c.id === t.course)!;
              const photos = t.evidence.some((id) =>
                data.files.find((f) => f.id === id)?.mime.startsWith("image/"),
              );
              return (
                <button
                  className="training-card"
                  key={t.id}
                  onClick={() => open({ type: "trainingDetail", data: t })}
                >
                  <div className={"course-icon " + t.course}>
                    <BookOpen size={23} />
                  </div>
                  <div className="training-main">
                    <div>
                      <Badge tone={t.status === "completed" ? "green" : "blue"}>
                        {t.status === "completed" ? "已完成" : "待开展"}
                      </Badge>
                      <span className="muted small">第 {c.day} 课</span>
                    </div>
                    <h3>{t.title}</h3>
                    <p>{t.method}</p>
                    <div className="training-meta">
                      <span>
                        <CalendarDays size={13} />
                        {fmtDate(t.scheduled_on)} {t.time}
                      </span>
                      <span>
                        <Clock size={13} />
                        {t.minutes} 分钟
                      </span>
                      <span>
                        <Users size={13} />
                        {t.present.length}/{t.attendees.length} 人签到
                      </span>
                      <span>
                        <Paperclip size={13} />
                        {t.evidence.length} 份附件
                      </span>
                    </div>
                  </div>
                  <div className="training-end">
                    {t.status === "completed" && !photos && (
                      <span className="text-amber small">实操照片待留痕</span>
                    )}
                    <span>
                      {t.status === "planned" && user.role !== "owner"
                        ? "签到与完成"
                        : "查看记录"}{" "}
                      <ArrowUpRight size={16} />
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <Empty
              title="还没有培训记录"
              text="按五门课程安排非高峰培训，并留存签到、实操照片和问题清单。"
            />
          )}
        </div>
      </section>
    </>
  );
}

export function StandardsPage() {
  const { standards } = useApp();
  const [selected, setSelected] = useState("hygiene");
  const c = standards.courses.find((c) => c.id === selected)!;
  return (
    <>
      <PageTitle
        eyebrow="STANDARDS / ONE SHARED WAY"
        title="课程标准库"
        subtitle="每一个检查点，都来自《百花里餐饮部员工培训计划书》。"
        actions={
          <a
            className="btn"
            href={sourceHref}
            download={TRIAL ? "百花里餐饮部员工培训计划书.docx" : undefined}
          >
            <Download size={16} />
            下载原计划书
          </a>
        }
      />
      <div className="standards-layout">
        <aside className="standards-nav panel">
          <span className="eyebrow">五门课程 / 180 MIN</span>
          {standards.courses.map((c) => (
            <button
              className={selected === c.id ? "active" : ""}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <span>0{c.day}</span>
              <div>
                <strong>{c.name}</strong>
                <small>
                  第 {c.day} 天 · {c.minutes} 分钟
                </small>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
          <div className="standard-tip">
            <BookOpen size={21} />
            <p>
              看得见、能检查、会操作。
              <br />
              标准的落地，比记住条文更重要。
            </p>
          </div>
        </aside>
        <section className="panel standard-content">
          <div className="standard-title">
            <div className={"course-icon " + c.id}>
              <BookOpen size={25} />
            </div>
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
              <ShieldAlert size={19} />
              <div>
                <strong>纪律红线</strong>
                <p>{c.redline}</p>
              </div>
            </div>
          )}
          {c.missing && (
            <div className="alert amber">
              <AlertCircle size={18} />
              <p>{c.missing}</p>
            </div>
          )}
          <div className="table-scroll">
            <table className="standards-table">
              <thead>
                <tr>
                  <th>检查项目</th>
                  <th>操作标准</th>
                  <th>考核 / 检查方法</th>
                </tr>
              </thead>
              <tbody>
                {c.items.map(([item, standard, method]) => (
                  <tr key={item}>
                    <td>
                      <strong>{item}</strong>
                    </td>
                    <td>{standard}</td>
                    <td>{method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="policy-grid">
        {[
          { title: "三个教法", items: standards.policies.teaching },
          { title: "纪律与留痕", items: standards.policies.discipline },
          {
            title: "考核与两周跟岗",
            items: [standards.policies.assessment, standards.policies.followup],
          },
        ].map((p) => (
          <div className="panel policy-card" key={p.title}>
            <h3>
              <CheckCircle2 size={17} />
              {p.title}
            </h3>
            {p.items.map((x, i) => (
              <p key={x}>
                <span>0{i + 1}</span>
                {x}
              </p>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

export function Library() {
  const { data, open } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = data.files.filter(
    (f) =>
      f.name.toLowerCase().includes(q.toLowerCase()) &&
      (filter === "all" ||
        (filter === "image"
          ? f.mime.startsWith("image/")
          : filter === "video"
            ? f.mime.startsWith("video/")
            : !f.mime.startsWith("image/") && !f.mime.startsWith("video/"))),
  );
  return (
    <>
      <PageTitle
        eyebrow="LIBRARY / EVIDENCE MATTERS"
        title="资料与留痕"
        subtitle="签到表、实操影像、问题清单，让每一次培训都有据可查。"
        actions={
          <button
            className="btn primary"
            onClick={() => open({ type: "upload" })}
          >
            <UploadCloud size={17} />
            上传资料
          </button>
        }
      />
      <div className="library-notice">
        <div>
          <span>
            <Paperclip size={22} />
          </span>
          <div>
            <h3>把进步记录下来</h3>
            <p>
              支持照片、视频、Word、PDF、Excel、CSV 等文件，单个文件最大 100
              MB。
            </p>
          </div>
        </div>
        <small>
          <ShieldAlert size={14} />{" "}
          突发事件不围观、不拍照、不传播；上传仅限合规培训素材。
        </small>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {[
              ["all", "全部资料"],
              ["image", "照片"],
              ["video", "视频"],
              ["document", "文档与表格"],
            ].map(([v, t]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {t}
                {v === "all" && <span>{data.files.length}</span>}
              </button>
            ))}
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="搜索文件名" />
        </div>
        {rows.length ? (
          <div className="asset-grid">
            {rows.map((f) => (
              <button
                className="asset-card"
                key={f.id}
                onClick={() => open({ type: "file", data: f })}
              >
                <div
                  className={
                    "asset-thumb " +
                    (f.mime.startsWith("image/")
                      ? "image"
                      : f.mime.startsWith("video/")
                        ? "video"
                        : "document")
                  }
                >
                  {f.mime.startsWith("image/") ? (
                    <img src={assetUrl(f.id)} alt={f.name} loading="lazy" />
                  ) : (
                    <FileIcon file={f} size={37} />
                  )}
                  <span>{f.name.split(".").at(-1)?.toUpperCase()}</span>
                </div>
                <div className="asset-info">
                  <h4 title={f.name}>{f.name}</h4>
                  <p>
                    <span>{f.category}</span>
                    <span>{fileSize(f.size)}</span>
                  </p>
                  <small>
                    {f.uploader} · {fmtDate(f.created)}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="留存第一份培训资料"
            text="上传后可关联到培训、员工考核或整改反馈中。演示空间不包含虚构附件。"
            action={
              <button className="btn" onClick={() => open({ type: "upload" })}>
                <Plus size={16} />
                上传资料
              </button>
            }
          />
        )}
      </section>
    </>
  );
}

export function Followups() {
  const { data, user, open } = useApp();
  const [tab, setTab] = useState("directives");
  const [filter, setFilter] = useState("all");
  const directives = data.directives
    .filter((d) => filter === "all" || d.status === filter)
    .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <>
      <PageTitle
        eyebrow="FOLLOW THROUGH / CLOSE THE LOOP"
        title="跟进与整改"
        subtitle="把问题变成行动，把管理要求落实到每一天。"
        actions={
          user.role !== "trainer" ? (
            <button
              className="btn primary"
              onClick={() => open({ type: "directive" })}
            >
              <Plus size={17} />
              下达指令
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => open({ type: "followup" })}
            >
              <Plus size={17} />
              记录跟岗
            </button>
          )
        }
      />
      <div className="page-tabs">
        {[
          ["directives", "管理指令", Flag],
          ["daily", "两周跟岗", CalendarDays],
          ["complaints", "客诉登记", MessageSquare],
        ].map(([v, t, Icon]: any) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => setTab(v)}
          >
            <Icon size={17} />
            {t}
            <span>
              {v === "directives"
                ? data.directives.filter((d) => d.status !== "closed").length
                : v === "daily"
                  ? data.followups.length
                  : data.complaints.length}
            </span>
          </button>
        ))}
      </div>
      {tab === "directives" ? (
        <>
          <div className="flow-description">
            <span>01 下达指令</span>
            <ChevronRight size={14} />
            <span>02 执行反馈</span>
            <ChevronRight size={14} />
            <span>03 提交复核</span>
            <ChevronRight size={14} />
            <span>04 管理层验收</span>
          </div>
          <section className="panel">
            <div className="toolbar">
              <div className="tabs">
                {[["all", "全部"], ...Object.entries(statusNames)].map(
                  ([v, t]) => (
                    <button
                      key={v}
                      className={filter === v ? "active" : ""}
                      onClick={() => setFilter(v)}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
              <span className="muted small">每条指令的反馈与状态均留痕</span>
            </div>
            <div className="directive-grid">
              {directives.length ? (
                directives.map((d) => (
                  <button
                    className="directive-card"
                    key={d.id}
                    onClick={() => open({ type: "directiveDetail", data: d })}
                  >
                    <div className="directive-card-head">
                      <span className={"directive-mark " + d.priority}>
                        <Flag size={17} />
                      </span>
                      <Badge
                        tone={
                          d.status === "closed"
                            ? "green"
                            : d.status === "submitted"
                              ? "blue"
                              : d.priority === "high"
                                ? "amber"
                                : "gray"
                        }
                      >
                        {statusNames[d.status]}
                      </Badge>
                      {d.priority === "high" && (
                        <span className="text-amber small">重点</span>
                      )}
                    </div>
                    <h3>{d.title}</h3>
                    <p>{d.detail}</p>
                    <div className="directive-person">
                      <Avatar
                        name={employeeName(data, d.employee_id)}
                        size="xs"
                      />
                      <span>{employeeName(data, d.employee_id)}</span>
                    </div>
                    <footer>
                      <span>{d.author} 下达</span>
                      <span
                        className={
                          d.due < data.today && d.status !== "closed"
                            ? "text-red"
                            : ""
                        }
                      >
                        <Clock size={13} />
                        {fmtDate(d.due)} 截止
                      </span>
                      <ChevronRight size={14} />
                    </footer>
                  </button>
                ))
              ) : (
                <Empty
                  title="暂无管理指令"
                  text="管理层可以针对员工问题下达指令，培训专员反馈后提交复核。"
                />
              )}
            </div>
          </section>
        </>
      ) : tab === "daily" ? (
        <>
          <div className="section-line">
            <p>
              达标后跟岗两周，每天记录一句鼓励、一个纠正动作。未达标员工优先安排二次培训。
            </p>
            {user.role !== "owner" && (
              <button
                className="btn primary"
                onClick={() => open({ type: "followup" })}
              >
                <Plus size={16} />
                记录跟岗
              </button>
            )}
          </div>
          <div className="followup-grid">
            {data.employees
              .filter((e) => e.active)
              .map((e, i) => {
                const history = data.assessments
                  .filter((a) => a.employee_id === e.id)
                  .sort(
                    (a, b) =>
                      a.assessed_on.localeCompare(b.assessed_on) || a.id - b.id,
                  );
                const lastFail = history.findLastIndex((a) => a.total < 80);
                const pass = history
                  .slice(lastFail + 1)
                  .find((a) => a.total >= 80);
                const records = data.followups.filter(
                  (f) => f.employee_id === e.id,
                );
                const start = pass?.assessed_on;
                const dates = start
                  ? Array.from({ length: 14 }, (_, i) => dateAdd(start, i))
                  : [];
                const done = dates.filter((day) =>
                  records.some((r) => r.recorded_on === day),
                ).length;
                return (
                  <div className="panel followup-card" key={e.id}>
                    <div className="followup-head">
                      <Avatar name={e.name} index={i} />
                      <div>
                        <h3>{e.name}</h3>
                        <p>
                          {start
                            ? fmtDate(start) + " 起 · 14 天跟岗"
                            : "尚未达标 · 需二次培训"}
                        </p>
                      </div>
                      <span>
                        {done}
                        <small> / 14</small>
                      </span>
                    </div>
                    {start ? (
                      <>
                        <div className="day-grid">
                          {dates.map((d, j) => {
                            const f = records.find((r) => r.recorded_on === d);
                            return (
                              <button
                                key={d}
                                title={`${d} ${f ? "已记录" : d > data.today ? "尚未开始" : "待记录"}`}
                                className={
                                  f
                                    ? "done"
                                    : d > data.today
                                      ? "future"
                                      : "missing"
                                }
                                onClick={() =>
                                  open({
                                    type: f ? "followupDetail" : "followup",
                                    data: f || {
                                      employee_id: e.id,
                                      recorded_on:
                                        d > data.today ? data.today : d,
                                    },
                                  })
                                }
                              >
                                {f ? <Check size={13} /> : j + 1}
                              </button>
                            );
                          })}
                        </div>
                        <p className="muted small">
                          两周已记录 {done} 天 · 缺失记录会保留为空白
                        </p>
                      </>
                    ) : (
                      <div className="alert amber small">
                        先示范、再练习，复训合格后开始两周跟岗。
                      </div>
                    )}
                    {records[0] && (
                      <div className="daily-excerpt">
                        <span>
                          {shortDate(records[0].recorded_on)} · 最近反馈
                        </span>
                        <p>{records[0].encouragement}</p>
                        <p className="muted">纠正：{records[0].correction}</p>
                      </div>
                    )}
                    <button
                      className="text-button"
                      onClick={() => open({ type: "employeeDetail", data: e })}
                    >
                      查看完整档案 <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })}
          </div>
          {!data.employees.length && <Empty title="请先添加员工" />}
        </>
      ) : (
        <>
          <div className="section-line">
            <p>听完 → 复述 → 给方案 → 上报留痕。超过 50 元必须经理审批。</p>
            {user.role !== "owner" && (
              <button
                className="btn primary"
                onClick={() => open({ type: "complaint" })}
              >
                <Plus size={16} />
                登记客诉
              </button>
            )}
          </div>
          <section className="panel">
            {data.complaints.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>客诉摘要</th>
                      <th>当班员工</th>
                      <th>处理金额</th>
                      <th>处理 / 审批</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.complaints.map((c) => (
                      <tr key={c.id}>
                        <td>{fmtDate(c.occurred_on)}</td>
                        <td>{c.summary}</td>
                        <td>{employeeName(data, c.employee_id)}</td>
                        <td>¥{c.amount}</td>
                        <td>
                          <Badge
                            tone={
                              c.status === "pending_approval"
                                ? "amber"
                                : "green"
                            }
                          >
                            {c.status === "pending_approval"
                              ? "待经理审批"
                              : c.status === "approved"
                                ? "已批准"
                                : "已登记"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="row-action"
                            onClick={() =>
                              open({ type: "complaintDetail", data: c })
                            }
                          >
                            查看
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="暂无客诉登记"
                text="不上传突发事件现场影像；只记录处理事实、具体方案、时间与上报情况。"
              />
            )}
          </section>
        </>
      )}
    </>
  );
}

export function Reports() {
  const { data, user, standards, open, toast } = useApp();
  const [mode, setMode] = useState("week");
  const [start, setStart] = useState(dateAdd(data.today, -6));
  const [end, setEnd] = useState(data.today);
  const m = metrics(data, start, end);
  const trainings = data.trainings.filter(
    (t) =>
      t.status === "completed" &&
      t.scheduled_on >= start &&
      t.scheduled_on <= end,
  );
  const follows = data.followups.filter(
    (f) => f.recorded_on >= start && f.recorded_on <= end,
  );
  const records = m.records.sort(
    (a, b) => b.assessed_on.localeCompare(a.assessed_on) || b.id - a.id,
  );
  const avg = m.records.length
    ? +(m.records.reduce((s, a) => s + a.total, 0) / m.records.length).toFixed(
        1,
      )
    : null;
  function period(v: string) {
    setMode(v);
    if (v !== "custom") {
      setStart(dateAdd(data.today, v === "day" ? 0 : v === "week" ? -6 : -29));
      setEnd(data.today);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="INSIGHTS / SEE THE PROGRESS"
        title="培训汇报"
        subtitle="从日常记录到管理决策，清楚看到谁进步了、谁还需要帮助。"
        actions={
          <>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} />
              打印 / 保存 PDF
            </button>
            <a
              className="btn primary"
              href={reportHref(data, start, end)}
              download={
                TRIAL ? `baihuali-assessments-${start}-${end}.csv` : undefined
              }
            >
              <Download size={16} />
              导出考核明细
            </a>
          </>
        }
      />
      <section className="panel report-filters no-print">
        <div className="tabs">
          {[
            ["day", "日报"],
            ["week", "近 7 天"],
            ["month", "近 30 天"],
            ["custom", "自定义"],
          ].map(([v, t]) => (
            <button
              key={v}
              className={mode === v ? "active" : ""}
              onClick={() => period(v)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <input
            type="date"
            value={start}
            aria-label="汇报开始日期"
            max={end}
            onChange={(e) => {
              if (e.target.value) {
                setMode("custom");
                setStart(e.target.value);
              }
            }}
          />
          <span className="muted">至</span>
          <input
            type="date"
            value={end}
            aria-label="汇报结束日期"
            min={start}
            max={data.today}
            onChange={(e) => {
              if (e.target.value) {
                setMode("custom");
                setEnd(e.target.value);
              }
            }}
          />
        </div>
      </section>
      <section className="report-cover">
        <div>
          <span className="eyebrow">BAIHUALI · TRAINING REPORT</span>
          <h2>餐饮部培训{mode === "day" ? "日报" : "阶段汇报"}</h2>
          <p>
            {fmtDate(start)} — {fmtDate(end)} <span>｜</span> 生成于{" "}
            {fmtDate(data.today)} · {user.name}
          </p>
        </div>
        <span className="report-stamp">
          <Leaf size={25} />
          <small>每日精进</small>
        </span>
      </section>
      <div className="report-stats">
        {[
          ["考核记录", m.records.length, "条"],
          ["期间考核均分", avg ?? "—", "分"],
          ["已达标员工", m.passed, "人"],
          ["完成培训", trainings.length, "场"],
          ["跟岗记录", follows.length, "条"],
        ].map(([t, v, u]) => (
          <div key={t}>
            <span>{t}</span>
            <strong>
              {v}
              <small>{u}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="report-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>员工表现概览</h3>
              <p>选定期间内每位员工的最近一次考核</p>
            </div>
            <Users size={19} />
          </div>
          <div className="report-people">
            {data.employees
              .filter((e) => e.active)
              .map((e, i) => {
                const a = m.last.find((a) => a.employee_id === e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => open({ type: "employeeDetail", data: e })}
                  >
                    <Avatar name={e.name} index={i} />
                    <div>
                      <strong>{e.name}</strong>
                      <small>{a ? a.notes : "本期间暂无考核"}</small>
                    </div>
                    <span
                      className={"score " + (a && a.total < 80 ? "low" : "")}
                    >
                      {a?.total ?? "—"}
                    </span>
                    <Badge
                      tone={!a ? "gray" : a.total < 80 ? "amber" : "green"}
                    >
                      {!a ? "待考核" : a.total < 80 ? "需复训" : "已达标"}
                    </Badge>
                  </button>
                );
              })}
            {!data.employees.length && <Empty title="暂无员工数据" />}
          </div>
        </section>
        <section className="panel report-summary">
          <h3>管理摘要</h3>
          <div>
            <span className="summary-number">01</span>
            <p>
              <strong>本期培训</strong>完成 {trainings.length} 场课程，共{" "}
              {trainings.reduce((s, t) => s + t.present.length, 0)} 人次签到；
              {trainings.filter((t) => !t.evidence.length).length}{" "}
              场未附留痕文件。
            </p>
          </div>
          <div>
            <span className="summary-number">02</span>
            <p>
              <strong>需要帮助</strong>
              {m.last.filter((a) => a.total < 80).length
                ? m.last
                    .filter((a) => a.total < 80)
                    .map((a) => employeeName(data, a.employee_id))
                    .join("、") + " 未达 80 分，安排针对性二次培训。"
                : "本期间未发现已考核员工低于合格线。"}
              {m.employees.length - m.last.length > 0 &&
                ` 另有 ${m.employees.length - m.last.length} 人未考核。`}
            </p>
          </div>
          <div>
            <span className="summary-number">03</span>
            <p>
              <strong>后续行动</strong>当前有{" "}
              {data.directives.filter((d) => d.status !== "closed").length}{" "}
              项指令待闭环，其中{" "}
              {
                data.directives.filter(
                  (d) => d.due < data.today && d.status !== "closed",
                ).length
              }{" "}
              项逾期。红线事件{" "}
              {m.records.filter((a) => a.redlines.length).length} 条。
            </p>
          </div>
          {user.role !== "trainer" && (
            <button
              className="btn no-print"
              onClick={() => open({ type: "directive" })}
            >
              <Plus size={16} />
              针对问题下达指令
            </button>
          )}
        </section>
      </div>
      <section className="panel report-detail">
        <div className="panel-heading">
          <div>
            <h3>考核明细</h3>
            <p>实操 60 + 现场观察 30 + 口述 10 · 合格线 80 分</p>
          </div>
          <span className="muted">{records.length} 条记录</span>
        </div>
        {records.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>员工</th>
                  {standards.parts.map((p) => (
                    <th key={p.key}>{p.name}</th>
                  ))}
                  <th>总分</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {records.map((a) => (
                  <tr key={a.id}>
                    <td>{shortDate(a.assessed_on)}</td>
                    <td>{employeeName(data, a.employee_id)}</td>
                    {standards.parts.map((p) => (
                      <td key={p.key}>{a.scores[p.key]}</td>
                    ))}
                    <td>
                      <strong>{a.total}</strong>
                    </td>
                    <td>{a.total >= 80 ? "达标" : "需二次培训"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="本期间暂无考核"
            text="调整日期范围，或提交员工考核后再次查看。"
          />
        )}
      </section>
      <div className="report-footer">
        报告依据已录入数据生成，不代表未记录事项已完成。 · 百花里餐饮部
      </div>
    </>
  );
}

export function Settings() {
  const { user, data, open } = useApp();
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE / SETTINGS"
        title="工作区与权限"
        subtitle="明确分工，让培训、考核与管理有序协作。"
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="eyebrow">CURRENT WORKSPACE</span>
          <h2>
            {TRIAL
              ? "个人浏览器试用"
              : user.tenant === "demo"
                ? "演示工作区"
                : "正式工作区"}
          </h2>
          <p>
            {TRIAL
              ? "当前为免费个人试用版。评分和文件保存在此浏览器，刷新后可继续；其他设备无法共享，清理网站数据后会丢失。请使用测试资料。"
              : user.tenant === "demo"
                ? "当前所有员工、评分与记录均为演示数据，与正式工作区完全隔离。"
                : "记录保存到服务端数据库，附件保存在服务端文件目录，多个账号共享同一工作区。"}
          </p>
          <button
            className="btn primary"
            onClick={() => open({ type: "login" })}
          >
            {TRIAL
              ? "试用说明 / 重置数据"
              : user.tenant === "demo"
                ? "创建 / 登录正式工作区"
                : "切换登录账号"}
            <ArrowRight size={16} />
          </button>
        </section>
        <section className="panel settings-card">
          <span className="eyebrow">ACCESS CONTROL</span>
          <h2>三类角色，各司其职</h2>
          <div className="role-list">
            <p>
              <strong>培训专员</strong>
              <span>员工、培训签到、上传、评分、跟岗与整改反馈</span>
            </p>
            <p>
              <strong>餐饮经理</strong>
              <span>专员权限 + 管理指令、整改复核、客诉审批</span>
            </p>
            <p>
              <strong>管理层 / 老板</strong>
              <span>查看全局、汇报导出、下达指令、复核、账号管理</span>
            </p>
          </div>
          {user.role === "owner" && (
            <button className="btn" onClick={() => open({ type: "accounts" })}>
              <Users size={16} />
              管理账号
            </button>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>操作留痕</h3>
            <p>记录谁在什么时候完成了什么操作</p>
          </div>
          <Badge tone="gray">最近 {Math.min(50, data.audit.length)} 条</Badge>
        </div>
        {data.audit.length ? (
          <div className="audit-list">
            {data.audit.slice(0, 50).map((a) => (
              <div key={a.id}>
                <span className="audit-dot" />
                <strong>{a.actor}</strong>
                <p>{a.action}</p>
                <time>{a.created.slice(0, 16).replace("T", " ")}</time>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="暂无操作记录"
            text="新增培训、考核、指令和附件后将自动记录。"
          />
        )}
      </section>
    </>
  );
}
