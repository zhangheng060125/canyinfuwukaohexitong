import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Users,
  ChartNoAxesCombined,
  ClipboardCheck,
  Flag,
  CalendarDays,
  ChevronRight,
  Clock,
  Check,
  Leaf,
  BookOpen,
  Ellipsis,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useApp } from "./context";
import { Avatar, Badge, Empty, PageTitle } from "./components";
import {
  completedCourses,
  latest,
  metrics,
  employeeName,
  statusNames,
} from "./metrics";
import { dateAdd, shortDate } from "./api";

export function EmployeeTable({
  limit,
  search = "",
  filter = "all",
}: {
  limit?: number;
  search?: string;
  filter?: string;
}) {
  const { data, open, user } = useApp();
  const employees = data.employees
    .filter((e) => e.name.includes(search) || e.position.includes(search))
    .filter((e) =>
      filter === "archived"
        ? !e.active
        : e.active &&
          (filter === "all" ||
            (filter === "risk"
              ? (latest(data, e.id)?.total ?? 100) < 80
              : filter === "passed"
                ? (latest(data, e.id)?.total ?? 0) >= 80
                : !latest(data, e.id))),
    );
  return employees.length ? (
    <div className="table-scroll">
      <table className="employee-table">
        <thead>
          <tr>
            <th>员工</th>
            <th>培训进度</th>
            <th>最新评分</th>
            <th>当前状态</th>
            <th>最近考核</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {employees.slice(0, limit).map((e, i) => {
            const a = latest(data, e.id);
            const done = completedCourses(data, e.id);
            return (
              <tr key={e.id}>
                <td>
                  <button
                    className="person-cell"
                    onClick={() => open({ type: "employeeDetail", data: e })}
                  >
                    <Avatar name={e.name} index={i} />
                    <span>
                      <strong>{e.name}</strong>
                      <small>
                        {e.position} · {e.group_name}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <div className="progress-cell">
                    <div className="track">
                      <i style={{ width: done * 20 + "%" }} />
                    </div>
                    <small>{done} / 5</small>
                  </div>
                </td>
                <td>
                  {a ? (
                    <span className={"score " + (a.total < 80 ? "low" : "")}>
                      {a.total}
                      <small> / 100</small>
                    </span>
                  ) : (
                    <span className="muted">未考核</span>
                  )}
                </td>
                <td>
                  <Badge
                    tone={
                      !e.active
                        ? "gray"
                        : a
                          ? a.total >= 80
                            ? "green"
                            : "amber"
                          : "gray"
                    }
                  >
                    {!e.active
                      ? "已停用"
                      : a
                        ? a.total >= 80
                          ? "已达标"
                          : "需二次培训"
                        : "待考核"}
                  </Badge>
                </td>
                <td className="muted">{a ? shortDate(a.assessed_on) : "—"}</td>
                <td>
                  <button
                    className="row-action"
                    onClick={() => open({ type: "employeeDetail", data: e })}
                  >
                    查看
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="暂无符合条件的员工"
      text="添加员工后即可安排培训、建立考核档案。"
      action={
        user.role !== "owner" && (
          <button className="btn" onClick={() => open({ type: "employee" })}>
            <Plus size={16} />
            添加员工
          </button>
        )
      }
    />
  );
}
export function Dashboard() {
  const { data, standards, user, open, go } = useApp();
  const [range, setRange] = useState(7);
  const m = metrics(data);
  const recent = metrics(data, dateAdd(data.today, -6), data.today);
  const pct = m.employees.length
    ? Math.round((m.completed / (m.employees.length * 5)) * 100)
    : 0;
  const chart = Array.from({ length: range }, (_, i) => {
    const day = dateAdd(data.today, i - range + 1);
    const rows = data.assessments.filter((a) => a.assessed_on === day);
    return {
      day: shortDate(day),
      score: rows.length
        ? +(rows.reduce((s, a) => s + a.total, 0) / rows.length).toFixed(1)
        : null,
    };
  });
  const prev = metrics(data, dateAdd(data.today, -13), dateAdd(data.today, -7));
  const delta =
    recent.avg !== null && prev.avg !== null
      ? +(recent.avg - prev.avg).toFixed(1)
      : null;
  const pending = data.directives
    .filter((d) => d.status !== "closed")
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 3);
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE / OVERVIEW"
        title={`${user.name}，${Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Shanghai" }).format(new Date())) < 12 ? "上午" : "下午"}好`}
        subtitle="每一份认真，都让服务更有温度。这里是前厅团队的成长动态。"
        actions={
          <>
            <button className="btn" onClick={() => go("reports")}>
              <CalendarDays size={16} />
              查看日报
            </button>
            {user.role !== "owner" ? (
              <button
                className="btn primary"
                onClick={() => open({ type: "assessment" })}
              >
                <Plus size={17} />
                新建考核
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => open({ type: "directive" })}
              >
                <Plus size={17} />
                下达指令
              </button>
            )}
          </>
        }
      />
      <section className="hero">
        <div className="hero-content">
          <span className="hero-label">
            <span /> 百花里 · 服务成长计划
          </span>
          <h2>
            让标准成为习惯，
            <br />
            让服务更有温度。
          </h2>
          <p>五门课程 · 因人施教 · 把每个动作做到位</p>
          <button onClick={() => go("training")}>
            查看培训计划 <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="plant-stem" />
          <Leaf className="leaf leaf-1" />
          <Leaf className="leaf leaf-2" />
          <Leaf className="leaf leaf-3" />
          <div className="plate">
            <div>
              <span>百花里</span>
              <small>BAI HUA LI</small>
            </div>
          </div>
          <span className="decor-star">✦</span>
        </div>
        <div className="hero-progress">
          <div
            className="ring"
            style={{ "--progress": pct + "%" } as React.CSSProperties}
          >
            <div>
              <strong>
                {pct}
                <span>%</span>
              </strong>
              <small>课程完成率</small>
            </div>
          </div>
          <p>
            <Check size={14} /> 已签到完成 {m.completed} /{" "}
            {m.employees.length * 5} 人次课程
          </p>
        </div>
      </section>
      <div className="stats-grid">
        {[
          {
            title: "在训员工",
            value: m.employees.length,
            unit: "人",
            icon: Users,
            foot: "前厅团队 · 因人施教",
            tone: "green",
          },
          {
            title: "团队平均分",
            value: m.avg ?? "—",
            unit: "分",
            icon: ChartNoAxesCombined,
            foot:
              delta !== null
                ? `较上周 ${delta >= 0 ? "+" : ""}${delta} 分`
                : "每人最新成绩 · 满分 100",
            tone: "blue",
          },
          {
            title: "考核达标率",
            value: m.last.length
              ? Math.round((m.passed / m.last.length) * 100)
              : "—",
            unit: "%",
            icon: ClipboardCheck,
            foot: `${m.passed} 人已达标 / ${m.last.length} 人已考核`,
            tone: "green",
          },
          {
            title: "待跟进事项",
            value: m.pending,
            unit: "项",
            icon: Flag,
            foot: `${m.risks.length} 人需重点关注 · 持续跟进`,
            tone: "amber",
          },
        ].map((s, i) => (
          <button
            key={s.title}
            className="stat-card"
            onClick={() =>
              go(["employees", "assessments", "assessments", "followups"][i])
            }
          >
            <div className="stat-top">
              <span>{s.title}</span>
              <span className={"stat-icon " + s.tone}>
                <s.icon size={19} />
              </span>
            </div>
            <div className="stat-value">
              {s.value}
              <small>{s.unit}</small>
            </div>
            <div className="stat-foot">
              {i === 1 && delta !== null ? (
                <ArrowUpRight size={13} />
              ) : (
                <span className={"tiny-dot " + s.tone} />
              )}{" "}
              {s.foot}
              <ArrowRight size={13} />
            </div>
          </button>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>
                团队成长趋势 <span className="subtle-label">GROWTH</span>
              </h3>
              <p>每日考核均分，记录每一步进步</p>
            </div>
            <select
              aria-label="趋势时间范围"
              value={range}
              onChange={(e) => setRange(+e.target.value)}
            >
              <option value={7}>近 7 天</option>
              <option value={14}>近 14 天</option>
            </select>
          </div>
          <div className="chart-legend">
            <span>
              <i />
              考核平均分
            </span>
            <span>
              <i className="dashed" />
              合格线 80 分
            </span>
          </div>
          <div className="chart">
            {m.records.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chart}
                  margin={{ top: 15, right: 16, left: -28, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#428a6d" stopOpacity={0.2} />
                      <stop
                        offset="100%"
                        stopColor="#428a6d"
                        stopOpacity={0.015}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#edf0ed"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#949c99", fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    domain={[40, 100]}
                    ticks={[40, 60, 80, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#949c99", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [v + " 分", "平均分"]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e5ebe7",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#b6bd9e"
                    strokeDasharray="5 5"
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="score"
                    stroke="#36795d"
                    strokeWidth={2.5}
                    fill="url(#scoreFill)"
                    connectNulls={false}
                    dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                title="等待第一条考核数据"
                text="提交考核后，成长趋势会自动呈现。"
              />
            )}
          </div>
          <div className="chart-caption">
            <span>
              <span className="tiny-dot green" /> 本周期共{" "}
              {
                metrics(data, dateAdd(data.today, -range + 1), data.today)
                  .records.length
              }{" "}
              条考核记录
            </span>
            <button className="text-button" onClick={() => go("reports")}>
              查看完整报告 <ArrowRight size={13} />
            </button>
          </div>
        </section>
        <section className="panel focus-panel">
          <div className="panel-heading">
            <div>
              <h3>
                <span className="focus-dot" /> 重点关注
              </h3>
              <p>发现问题，是变好的第一步</p>
            </div>
            <span className="count-label">{m.risks.length} 人</span>
          </div>
          {m.risks.length ? (
            m.risks.slice(0, 2).map((a) => (
              <button
                key={a.id}
                className="attention-card"
                onClick={() =>
                  open({
                    type: "employeeDetail",
                    data: data.employees.find((e) => e.id === a.employee_id),
                  })
                }
              >
                <div className="attention-head">
                  <Avatar name={employeeName(data, a.employee_id)} size="sm" />
                  <strong>{employeeName(data, a.employee_id)}</strong>
                  <Badge tone="amber">
                    {a.total < 80 ? "需二次培训" : "红线待核查"}
                  </Badge>
                  <span>
                    {a.total}
                    <small>分</small>
                  </span>
                </div>
                <p>{a.notes}</p>
                <div>
                  <span>
                    <Target size={13} />{" "}
                    {a.total < 80
                      ? "建议：单动作示范 + 跟岗纠正"
                      : "立即核查并处理红线事件"}
                  </span>
                  <ArrowUpRight size={15} />
                </div>
              </button>
            ))
          ) : (
            <div className="all-good">
              <ClipboardCheck size={32} />
              <h4>成长路上，稳步向前</h4>
              <p>暂无未达标或红线记录</p>
            </div>
          )}
          <div className="focus-note">
            <BookOpen size={16} />
            <p>
              不设淘汰。找到“教了但没落地”的动作，
              <br />
              回头重教，直到真正学会。
            </p>
          </div>
          <button className="focus-link" onClick={() => go("followups")}>
            查看跟进与整改 <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel staff-panel">
          <div className="panel-heading">
            <div>
              <h3>员工成长档案</h3>
              <p>每个人的进度，都值得被看见</p>
            </div>
            <button className="text-button" onClick={() => go("employees")}>
              全部员工 <ArrowRight size={14} />
            </button>
          </div>
          <EmployeeTable limit={4} />
        </section>
        <section className="panel directives-panel">
          <div className="panel-heading">
            <div>
              <h3>管理指令</h3>
              <p>明确方向，持续落地</p>
            </div>
            <button
              className="icon-btn"
              onClick={() => go("followups")}
              aria-label="查看所有管理指令"
            >
              <Ellipsis size={20} />
            </button>
          </div>
          <div className="compact-directives">
            {pending.length ? (
              pending.map((d) => (
                <button
                  key={d.id}
                  onClick={() => open({ type: "directiveDetail", data: d })}
                >
                  <span className={"directive-mark " + d.priority}>
                    <Flag size={15} />
                  </span>
                  <div>
                    <strong>{d.title}</strong>
                    <small>
                      {d.author} · {shortDate(d.due)} 截止 <i>·</i>{" "}
                      {statusNames[d.status]}
                    </small>
                  </div>
                  <ChevronRight size={14} />
                </button>
              ))
            ) : (
              <Empty title="暂无待办指令" text="所有指令都已完成" />
            )}
          </div>
          <button className="focus-link" onClick={() => go("followups")}>
            查看全部指令 <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <div className="bottom-note">
        <Leaf size={13} />{" "}
        以人为本，因人施教。让看得见的动作，成为留得住的服务。
      </div>
    </>
  );
}
