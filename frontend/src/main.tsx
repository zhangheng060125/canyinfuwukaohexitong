import { TRIAL, sourceHref } from "./mode";
import { TrialInfo } from "./trial/Info";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  Users,
  FolderOpen,
  Flag,
  ChartNoAxesCombined,
  BookOpen,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Leaf,
  LifeBuoy,
  Menu,
  X,
  Check,
  LogIn,
  LogOut,
  LoaderCircle,
  AlertCircle,
  PanelLeftClose,
  CalendarDays,
  Command,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { api, post, fmtDate } from "./api";
import { AppContext } from "./context";
import {
  Badge,
  Avatar,
  Modal,
  FilePreview,
  Empty,
  SearchInput,
} from "./components";
import { Dashboard } from "./Dashboard";
import {
  Employees,
  Assessments,
  Training,
  StandardsPage,
  Library,
  Followups,
  Reports,
  Settings as SettingsPage,
} from "./Pages";
import {
  EmployeeForm,
  AssessmentForm,
  AssessmentDetail,
  TrainingForm,
  TrainingDetail,
  DirectiveForm,
  DirectiveDetail,
  FollowupForm,
  FollowupDetail,
  EmployeeDetail,
  UploadForm,
  CourseDetail,
  ComplaintForm,
  ComplaintDetail,
  LoginForm,
  Accounts,
} from "./Forms";
import { metrics, employeeName, statusNames } from "./metrics";
import type { User, State, Standards, ModalSpec, Role } from "./types";
import "./styles.css";

const NAV = [
  { id: "overview", name: "工作总览", icon: LayoutDashboard },
  { id: "training", name: "培训计划", icon: GraduationCap },
  { id: "assessments", name: "考核与评分", icon: ClipboardCheck },
  { id: "employees", name: "员工档案", icon: Users },
  { id: "library", name: "资料与留痕", icon: FolderOpen },
  { id: "followups", name: "跟进与整改", icon: Flag },
  { id: "reports", name: "培训汇报", icon: ChartNoAxesCombined },
];
const ROLES: Record<Role, string> = {
  trainer: "培训专员",
  manager: "餐饮经理",
  owner: "管理层 / 老板",
};
const TITLES: Record<string, string> = {
  employee: "添加员工",
  assessment: "新建员工考核",
  assessmentDetail: "考核详情",
  training: "安排培训",
  trainingDetail: "培训记录",
  directive: "下达管理指令",
  directiveDetail: "指令与执行反馈",
  followup: "每日跟岗记录",
  followupDetail: "跟岗详情",
  employeeDetail: "员工成长档案",
  upload: "上传培训资料",
  file: "文件预览",
  course: "课程与检查标准",
  complaint: "客诉与突发情况登记",
  complaintDetail: "客诉处理记录",
  login: "正式工作区",
  trialInfo: "浏览器试用说明",
  accounts: "账号与角色管理",
  search: "搜索工作区",
  notifications: "待办与提醒",
  help: "使用帮助",
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<State | null>(null);
  const [standards, setStandards] = useState<Standards | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(location.hash.slice(1) || "overview");
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [mobile, setMobile] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [notices, setNotices] = useState<
    { id: number; message: string; error: boolean }[]
  >([]);
  const [initializing, setInitializing] = useState(false);
  const toast = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setNotices((n) => [...n, { id, message, error }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 5500);
  }, []);
  const refresh = useCallback(async () => {
    const d = await api<State>("/state");
    setData(d);
  }, []);
  const initialize = useCallback(async () => {
    setInitializing(true);
    setError("");
    try {
      const status = await api("/auth/status");
      let u = status.user;
      if (!u) u = await post("/auth/demo", { role: "trainer" });
      setUser(u);
      const [d, s] = await Promise.all([
        api<State>("/state"),
        api<Standards>("/standards"),
      ]);
      setData(d);
      setStandards(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInitializing(false);
    }
  }, []);
  useEffect(() => {
    initialize();
  }, [initialize]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && user)
        refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh, user]);
  useEffect(() => {
    const handler = () => {
      setPage(location.hash.slice(1) || "overview");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    const search = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal({ type: "search" });
      }
      if (e.key === "Escape") {
        setDropdown(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", search);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("keydown", search);
    };
  }, []);
  const go = (p: string) => {
    location.hash = p;
    setMobile(false);
    setModal(null);
  };
  const open = (m: ModalSpec) => {
    setModal(
      TRIAL && ["login", "accounts"].includes(m.type)
        ? { type: "trialInfo" }
        : m,
    );
    setDropdown(false);
  };
  const close = () => setModal(null);
  async function switchRole(role: Role) {
    try {
      const u = await post("/auth/demo", { role });
      setUser(u);
      await refresh();
      setDropdown(false);
      toast("已切换至" + ROLES[role] + "演示视角");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  if (!data || !standards || !user)
    return (
      <div className="loading-screen">
        <div className="brand-icon">
          <Leaf size={32} />
        </div>
        <h1>百花里</h1>
        <p>餐饮服务考核系统</p>
        {error ? (
          <>
            <div className="alert red">{error}</div>
            <button
              className="btn primary"
              onClick={initialize}
              disabled={initializing}
            >
              重新连接工作区
            </button>
          </>
        ) : (
          <LoaderCircle className="spin" size={22} />
        )}
      </div>
    );
  const m = metrics(data);
  const allRoutes = [
    ...NAV,
    { id: "standards", name: "课程标准库" },
    { id: "settings", name: "工作区与权限" },
  ];
  const current = allRoutes.find((n) => n.id === page);
  const pages: Record<string, React.ReactNode> = {
    overview: <Dashboard />,
    employees: <Employees />,
    assessments: <Assessments />,
    training: <Training />,
    standards: <StandardsPage />,
    library: <Library />,
    followups: <Followups />,
    reports: <Reports />,
    settings: <SettingsPage />,
  };
  const content = () => {
    if (!modal) return null;
    const p = modal.data;
    switch (modal.type) {
      case "trialInfo":
        return <TrialInfo />;
      case "employee":
        return <EmployeeForm />;
      case "assessment":
        return <AssessmentForm initial={p} />;
      case "assessmentDetail":
        return <AssessmentDetail record={p} />;
      case "training":
        return <TrainingForm initial={p} />;
      case "trainingDetail":
        return <TrainingDetail training={p} />;
      case "directive":
        return <DirectiveForm initial={p} />;
      case "directiveDetail":
        return <DirectiveDetail directive={p} />;
      case "followup":
        return <FollowupForm initial={p} />;
      case "followupDetail":
        return <FollowupDetail record={p} />;
      case "employeeDetail":
        return <EmployeeDetail employee={p} />;
      case "upload":
        return <UploadForm />;
      case "file":
        return <FilePreview file={p} />;
      case "course":
        return <CourseDetail course={p} />;
      case "complaint":
        return <ComplaintForm />;
      case "complaintDetail":
        return <ComplaintDetail record={p} />;
      case "login":
        return <LoginForm />;
      case "accounts":
        return <Accounts />;
      case "search":
        return <GlobalSearch />;
      case "notifications":
        return (
          <div className="notification-list">
            {data.directives
              .filter((d) => d.status !== "closed")
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => open({ type: "directiveDetail", data: d })}
                >
                  <span className={"directive-mark " + d.priority}>
                    <Flag size={17} />
                  </span>
                  <div>
                    <strong>{d.title}</strong>
                    <p>
                      {statusNames[d.status]} · {fmtDate(d.due)} 截止
                    </p>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
            {!m.pending && <Empty title="暂时没有待处理指令" />}
            {data.complaints
              .filter((c) => c.status === "pending_approval")
              .map((c) => (
                <button
                  key={"c" + c.id}
                  onClick={() => open({ type: "complaintDetail", data: c })}
                >
                  <MessageSquare size={18} />
                  <div>
                    <strong>{c.summary}</strong>
                    <p>客诉处理 ¥{c.amount} · 待经理审批</p>
                  </div>
                </button>
              ))}
          </div>
        );
      case "help":
        return (
          <div className="help-content">
            <div className="alert neutral">
              <Leaf size={20} />
              <p>
                本系统依据《百花里餐饮部员工培训计划书》建立。示范先于讲解，考核不设笔试。
              </p>
            </div>
            {[
              [
                "1",
                "建立员工档案",
                "添加前厅员工，正式工作区由管理员创建并分配登录账号。",
              ],
              [
                "2",
                "安排培训并留痕",
                "五门课程按计划开展，勾选实际签到员工，上传实操照片、签到表并填写当次问题清单。",
              ],
              [
                "3",
                "按规则考核评分",
                "实操 60 分、观察 30 分、口述 10 分。80 分合格；未达标二次培训，合格后两周跟岗。",
              ],
              [
                "4",
                "下达指令与复核",
                "经理或管理层下达指令，专员执行反馈并提交复核，管理层验收关闭；客诉超过 50 元需审批。",
              ],
              [
                "5",
                "每日或定期汇报",
                "在培训汇报中切换日报、近 7 天、近 30 天或自定义日期，导出考核明细，打印保存 PDF。",
              ],
            ].map(([n, t, s]) => (
              <div className="help-step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{s}</p>
                </div>
              </div>
            ))}
            <a
              className="btn"
              href={sourceHref}
              download={TRIAL ? "百花里餐饮部员工培训计划书.docx" : undefined}
            >
              <DownloadIcon />
              下载原计划书
            </a>
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <AppContext.Provider
      value={{
        data,
        standards,
        user,
        refresh,
        toast,
        open,
        close,
        go,
        setUser,
      }}
    >
      <div className="app-shell">
        {mobile && (
          <div className="sidebar-overlay" onClick={() => setMobile(false)} />
        )}
        <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
          <button className="brand" onClick={() => go("overview")}>
            <span className="brand-icon">
              <Leaf size={25} />
              <span />
            </span>
            <span>
              <strong>
                百花里<span>BAIHUALI</span>
              </strong>
              <small>餐饮服务考核系统</small>
            </span>
          </button>
          <div className="property-select">
            <span className="property-avatar">百</span>
            <div>
              <strong>森活百花里美宿</strong>
              <small>餐饮部 · 前厅团队</small>
            </div>
            <ShieldCheck size={15} />
          </div>
          <span className="nav-label">
            工作空间 <span>WORKSPACE</span>
          </span>
          <nav aria-label="主导航">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => go(n.id)}
              >
                <n.icon size={19} />
                <span>{n.name}</span>
                {n.id === "followups" && m.pending > 0 ? (
                  <b>{m.pending}</b>
                ) : page === n.id ? (
                  <span className="nav-active-dot" />
                ) : null}
              </button>
            ))}
          </nav>
          <span className="nav-label resources-label">标准与管理</span>
          <nav aria-label="管理导航">
            <button
              className={page === "standards" ? "active" : ""}
              onClick={() => go("standards")}
            >
              <BookOpen size={19} />
              <span>课程标准库</span>
              <span className="new-label">5 门</span>
            </button>
            <button
              className={page === "settings" ? "active" : ""}
              onClick={() => go("settings")}
            >
              <Settings size={19} />
              <span>工作区与权限</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="training-reminder">
              <span className="reminder-icon">
                <Leaf size={19} />
              </span>
              <strong>学会，更要会做。</strong>
              <p>
                先示范，再实操。
                <br />
                让每一次进步都被看见。
              </p>
              <button onClick={() => go("standards")}>
                一起把服务做好 <ArrowUpRight size={15} />
              </button>
            </div>
            <button
              className="help-button"
              onClick={() => open({ type: "help" })}
            >
              <LifeBuoy size={17} />
              使用帮助
              <ArrowUpRight size={14} />
            </button>
            <div className="sidebar-footer">
              <span className="tiny-dot green" /> 服务成长工作台{" "}
              <span>v1.0</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-btn mobile-menu"
                aria-label="打开导航菜单"
                onClick={() => setMobile(!mobile)}
              >
                <Menu size={20} />
              </button>
              <span>餐饮部</span>
              <ChevronRight size={13} />
              <strong>{current?.name || "工作总览"}</strong>
            </div>
            <div className="header-actions">
              <button
                className="global-search"
                onClick={() => open({ type: "search" })}
              >
                <Search size={16} />
                <span>搜索工作区</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="header-date">
                <CalendarDays size={14} />
                {fmtDate(data.today)}
              </span>
              <button
                className="notification-button icon-btn"
                aria-label="待办与提醒"
                onClick={() => open({ type: "notifications" })}
              >
                <Bell size={19} />
                {m.pending > 0 && <i />}
              </button>
              <div className="user-menu-wrap">
                <button
                  className="user-menu"
                  onClick={() => setDropdown(!dropdown)}
                  aria-expanded={dropdown}
                >
                  <Avatar name={user.name} size="sm" />
                  <span>
                    <strong>{user.name}</strong>
                    <small>{ROLES[user.role]}</small>
                  </span>
                  <ChevronDown size={14} />
                </button>
                {dropdown && (
                  <>
                    <div
                      className="dropdown-dismiss"
                      onClick={() => setDropdown(false)}
                    />
                    <div className="user-dropdown">
                      <div>
                        <strong>{user.name}</strong>
                        <small>
                          {user.tenant === "demo"
                            ? "演示视角切换"
                            : "正式工作区"}
                        </small>
                      </div>
                      {user.tenant === "demo" &&
                        (["trainer", "manager", "owner"] as Role[]).map(
                          (role) => (
                            <button key={role} onClick={() => switchRole(role)}>
                              {ROLES[role]}
                              {role === user.role && <Check size={14} />}
                            </button>
                          ),
                        )}
                      <button onClick={() => open({ type: "login" })}>
                        <LogIn size={15} />
                        {TRIAL
                          ? "试用说明 / 重置数据"
                          : user.tenant === "demo"
                            ? "登录 / 创建正式工作区"
                            : "切换登录账号"}
                      </button>
                      {user.tenant === "live" && (
                        <button
                          onClick={async () => {
                            await post("/auth/logout", {});
                            await initialize();
                            setDropdown(false);
                            toast("已退出正式账号，当前为演示空间");
                          }}
                        >
                          <LogOut size={15} />
                          退出正式工作区
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          {user.tenant === "demo" && (
            <div className="demo-bar">
              <span>
                <span className="demo-dot" />{" "}
                {TRIAL ? "本机试用" : "演示工作区"} <i>·</i>
                <span className="demo-detail">
                  {" "}
                  {TRIAL
                    ? "数据仅存当前浏览器 · 不同设备不共享 · 请使用测试资料"
                    : "当前员工与成绩均为示例，正式数据独立保存"}
                </span>
              </span>
              <button onClick={() => open({ type: "login" })}>
                {TRIAL ? "试用说明" : "进入正式工作区"}{" "}
                <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          <main className="main-content" id="main-content">
            {pages[page] || (
              <Empty
                title="页面不存在"
                action={
                  <button className="btn" onClick={() => go("overview")}>
                    回到工作总览
                  </button>
                }
              />
            )}
          </main>
          <footer className="app-footer">
            <span>© {data.today.slice(0, 4)} 森活百花里美宿 · 餐饮部</span>
            <span>
              认真服务，用心成长 <Leaf size={12} />
            </span>
          </footer>
        </div>
      </div>
      {modal && (
        <Modal
          key={modal.type + (modal.data?.id || "")}
          title={TITLES[modal.type] || ""}
          wide={[
            "assessment",
            "assessmentDetail",
            "employeeDetail",
            "file",
            "training",
            "course",
          ].includes(modal.type)}
          onClose={close}
        >
          {content()}
        </Modal>
      )}
      <div className="toast-stack" role="status" aria-live="polite">
        {notices.map((n) => (
          <div className={"toast " + (n.error ? "error" : "")} key={n.id}>
            {n.error ? <AlertCircle size={18} /> : <Check size={18} />}
            <span>{n.message}</span>
            <button
              className="icon-btn"
              aria-label="关闭提示"
              onClick={() => setNotices((s) => s.filter((v) => v.id !== n.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
function DownloadIcon() {
  return <ArrowUpRight size={16} />;
}
function GlobalSearch() {
  const { data, open, go } = React.useContext(AppContext);
  const [q, setQ] = useState("");
  const hits = [
    ...data.employees
      .filter((e) => e.name.includes(q) && q)
      .map((e) => ({
        key: "e" + e.id,
        title: e.name,
        sub: "员工档案 · " + e.position,
        action: () => open({ type: "employeeDetail", data: e }),
      })),
    ...data.files
      .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()) && q)
      .map((f) => ({
        key: "f" + f.id,
        title: f.name,
        sub: "资料 · " + f.category,
        action: () => open({ type: "file", data: f }),
      })),
    ...data.directives
      .filter((d) => (d.title.includes(q) || d.detail.includes(q)) && q)
      .map((d) => ({
        key: "d" + d.id,
        title: d.title,
        sub: "管理指令 · " + statusNames[d.status],
        action: () => open({ type: "directiveDetail", data: d }),
      })),
    ...data.trainings
      .filter((t) => t.title.includes(q) && q)
      .map((t) => ({
        key: "t" + t.id,
        title: t.title,
        sub: "培训 · " + t.scheduled_on,
        action: () => open({ type: "trainingDetail", data: t }),
      })),
  ];
  return (
    <div className="global-search-panel">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="输入员工姓名、培训主题、文件名或指令"
      />
      {q ? (
        <div className="search-results">
          {hits.length ? (
            hits.slice(0, 40).map((h) => (
              <button key={h.key} onClick={h.action}>
                <Search size={16} />
                <span>
                  <strong>{h.title}</strong>
                  <small>{h.sub}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              title="没有找到相关记录"
              text="尝试其他关键词，或检查是否位于正确的工作区。"
            />
          )}
        </div>
      ) : (
        <div className="search-shortcuts">
          <p className="muted small">快速前往</p>
          {NAV.slice(1).map((n) => (
            <button key={n.id} onClick={() => go(n.id)}>
              <n.icon size={17} />
              {n.name}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
