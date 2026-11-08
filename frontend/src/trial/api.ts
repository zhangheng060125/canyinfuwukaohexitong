/** Browser-only trial transport. Never used in the server-backed formal build. */
import sample from "./seed.json";
import { blobUrls } from "../mode";
import type { State, User } from "../types";
type Root = { data: State; user: User };
type Collection = Exclude<keyof State, "today">;
const NAME = "baihuali-browser-trial-v1";
const roleNames = { trainer: "许知夏", manager: "周明", owner: "沈总" };
let database: Promise<IDBDatabase> | null = null;
let queue: Promise<unknown> = Promise.resolve();
function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
}
function shift(day: string, n: number) {
  const d = new Date(day.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10) + day.slice(10);
}
function fresh(): Root {
  const raw = structuredClone(sample.data);
  const offset = Math.round(
    (Date.parse(today()) - Date.parse(raw.today)) / 86400000,
  );
  const value = JSON.parse(JSON.stringify(raw), (_key, v) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v)
      ? shift(v, offset)
      : v,
  );
  value.today = today();
  return {
    data: value,
    user: { name: roleNames.trainer, role: "trainer", tenant: "demo" },
  };
}
function openDb() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(
          new Error(
            "此浏览器不支持试用数据存储，请使用 Chrome、Edge 或 Safari",
          ),
        );
        return;
      }
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("meta");
        r.result.createObjectStore("blobs");
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () =>
        reject(new Error("无法打开浏览器存储，请允许网站使用本地数据。"));
    });
  return database;
}
async function read(): Promise<Root> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("meta", "readonly")
      .objectStore("meta")
      .get("root");
    r.onsuccess = () => resolve(r.result || fresh());
    r.onerror = () => reject(r.error);
  });
}
async function persist(
  root: Root,
  blob?: { id: number; body: Blob },
  reset = false,
) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.objectStore("meta").put(root, "root");
    if (reset) tx.objectStore("blobs").clear();
    if (blob) tx.objectStore("blobs").put(blob.body, blob.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("浏览器存储失败或空间不足，请先导出试用数据。"));
    tx.onabort = () =>
      reject(new Error("浏览器未保存本次操作，请检查可用空间。"));
  });
}
async function hydrate() {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const r = db
      .transaction("blobs", "readonly")
      .objectStore("blobs")
      .openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (!c) {
        resolve();
        return;
      }
      const id = Number(c.key);
      if (!blobUrls.has(id)) blobUrls.set(id, URL.createObjectURL(c.value));
      c.continue();
    };
    r.onerror = () => reject(r.error);
  });
}
function requireText(value: any, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("请填写" + label);
}
function checkDay(day: string, future = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)))
    throw new Error("日期格式无效");
  if (!future && day > today()) throw new Error("记录日期不能晚于今天");
}
export function trialRequest(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const run = queue.then(() => handle(path, options));
  queue = run.catch(() => {});
  return run;
}
async function handle(path: string, options: RequestInit) {
  const root = await read();
  root.data.today = today();
  const d = root.data,
    u = root.user;
  const col = (key: Collection): any[] => d[key];
  const id = (key: Collection) =>
    Math.max(0, ...col(key).map((r: any) => r.id)) + 1;
  const find = (key: Collection, rid: number) => {
    const r = col(key).find((r: any) => r.id === rid);
    if (!r) throw new Error("记录不存在");
    return r;
  };
  const allowed = (...roles: string[]) => {
    if (!roles.includes(u.role)) throw new Error("当前角色无此操作权限");
  };
  const files = (ids: number[] = []) =>
    ids.forEach((fid) => find("files", fid));
  const audit = (action: string) =>
    d.audit.unshift({
      id: id("audit"),
      actor: u.name,
      action,
      created: new Date().toISOString(),
    });
  const add = (key: Collection, body: any) => {
    const row = { id: id(key), ...body };
    col(key).unshift(row);
    return row;
  };
  const finish = async (result: any, action: string) => {
    audit(action);
    await persist(root);
    return result;
  };
  const body = typeof options.body === "string" ? JSON.parse(options.body) : {};
  const url = new URL(path, "https://trial.invalid");
  const p = url.pathname;
  const method = options.method || "GET";
  if (p === "/auth/status")
    return { initialized: false, user: u, setup_key_required: false };
  if (p === "/auth/demo") {
    if (!Object.hasOwn(roleNames, body.role)) throw new Error("无效角色");
    root.user = {
      role: body.role,
      name: roleNames[body.role as keyof typeof roleNames],
      tenant: "demo",
    };
    await persist(root);
    return root.user;
  }
  if (p === "/auth/logout") {
    root.user = fresh().user;
    await persist(root);
    return { ok: true };
  }
  if (p === "/auth/login" || p === "/auth/bootstrap" || p === "/users")
    throw new Error(
      "这是个人浏览器试用版。正式账号及多人共享需要部署服务器，试用阶段无需创建账号。",
    );
  if (p === "/trial/reset") {
    for (const value of blobUrls.values()) URL.revokeObjectURL(value);
    blobUrls.clear();
    const value = fresh();
    await persist(value, undefined, true);
    return value.user;
  }
  if (p === "/standards") return structuredClone(sample.standards);
  if (p === "/state") {
    await persist(root);
    await hydrate();
    return structuredClone(d);
  }
  if (p === "/employees" && method === "POST") {
    requireText(body.name, "员工姓名");
    requireText(body.position, "岗位");
    checkDay(body.joined);
    const row = add("employees", {
      ...body,
      name: body.name.trim(),
      active: 1,
    });
    return finish({ id: row.id }, "添加员工：" + row.name);
  }
  const archive = p.match(/^\/employees\/(\d+)\/archive$/);
  if (archive) {
    allowed("manager", "owner");
    const e = find("employees", +archive[1]);
    e.active = e.active ? 0 : 1;
    return finish({ ok: true }, "更新员工状态：" + e.name);
  }
  if (p === "/files" && options.body instanceof FormData) {
    const file = options.body.get("file");
    if (!(file instanceof File) || !file.size)
      throw new Error("请选择有效文件");
    if (file.size > 100 * 1024 * 1024)
      throw new Error("单个文件不得超过 100 MB");
    const ext = file.name.split(".").at(-1)?.toLowerCase();
    const types: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
      txt: "text/plain",
    };
    if (!ext || !types[ext])
      throw new Error(
        "文件格式不支持，请选择照片、视频、Word、PDF、Excel、CSV 或 TXT",
      );
    const row = add("files", {
      name: file.name,
      mime: types[ext],
      size: file.size,
      category: url.searchParams.get("category") || "培训资料",
      uploader: u.name,
      created: new Date().toISOString(),
    });
    audit("上传试用资料：" + file.name);
    await persist(root, {
      id: row.id,
      body: new Blob([file], { type: row.mime }),
    });
    blobUrls.set(
      row.id,
      URL.createObjectURL(new Blob([file], { type: row.mime })),
    );
    return row;
  }
  if (p === "/assessments") {
    allowed("trainer", "manager");
    const emp = find("employees", body.employee_id);
    if (!emp.active) throw new Error("已停用员工不可新增考核");
    checkDay(body.assessed_on);
    requireText(body.notes, "观察反馈及扣分依据");
    files(body.evidence);
    if (
      !["all", ...sample.standards.courses.map((c) => c.id)].includes(
        body.course,
      )
    )
      throw new Error("课程无效");
    if (Object.keys(body.scores || {}).length !== 5)
      throw new Error("须填写五项评分");
    for (const part of sample.standards.parts) {
      const n = body.scores?.[part.key];
      if (
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        n < 0 ||
        n > part.max ||
        Math.abs(n * 10 - Math.round(n * 10)) > 1e-8
      )
        throw new Error(part.name + "分值无效");
    }
    const total = +Object.values(body.scores as Record<string, number>)
      .reduce((a, b) => a + b, 0)
      .toFixed(1);
    const row = add("assessments", {
      ...body,
      total,
      assessor: u.name,
      created: new Date().toISOString(),
    });
    if (body.redlines?.length)
      add("directives", {
        employee_id: emp.id,
        title: "红线事件 · 立即核查",
        detail: body.notes,
        due: today(),
        priority: "high",
        status: "open",
        author: u.name,
        created: new Date().toISOString(),
      });
    return finish(
      { id: row.id, total, passed: total >= 80 },
      `提交考核：${emp.name} · ${total} 分`,
    );
  }
  if (p === "/trainings") {
    allowed("trainer", "manager");
    checkDay(body.scheduled_on, true);
    requireText(body.title, "培训主题");
    requireText(body.method, "教学方法");
    if (!body.attendees?.length) throw new Error("至少选择一位参训员工");
    body.attendees.forEach((eid: number) => find("employees", eid));
    files(body.evidence);
    if (!sample.standards.courses.some((c) => c.id === body.course))
      throw new Error("课程无效");
    if (body.present.some((v: number) => !body.attendees.includes(v)))
      throw new Error("签到员工须在参训名单中");
    if (body.status === "completed") {
      checkDay(body.scheduled_on);
      requireText(body.issues, "当次问题清单");
    }
    const row = add("trainings", {
      ...body,
      creator: u.name,
      created: new Date().toISOString(),
    });
    return finish({ id: row.id }, "记录培训：" + row.title);
  }
  const complete = p.match(/^\/trainings\/(\d+)\/complete$/);
  if (complete) {
    allowed("trainer", "manager");
    const row = find("trainings", +complete[1]);
    if (row.status !== "planned") throw new Error("培训已经完成，不能重复提交");
    checkDay(row.scheduled_on);
    requireText(body.issues, "当次问题清单");
    files(body.evidence);
    if (body.present.some((v: number) => !row.attendees.includes(v)))
      throw new Error("签到员工须在参训名单中");
    Object.assign(row, body, { status: "completed" });
    return finish({ ok: true }, "完成培训与签到：" + row.title);
  }
  if (p === "/directives") {
    allowed("manager", "owner");
    requireText(body.title, "指令标题");
    requireText(body.detail, "执行要求");
    checkDay(body.due, true);
    if (body.employee_id) find("employees", body.employee_id);
    const row = add("directives", {
      ...body,
      status: "open",
      author: u.name,
      created: new Date().toISOString(),
    });
    return finish({ id: row.id }, "下达指令：" + row.title);
  }
  const comment = p.match(/^\/directives\/(\d+)\/comments$/);
  if (comment) {
    const row = find("directives", +comment[1]);
    requireText(body.body, "执行反馈");
    files(body.evidence);
    if (body.transition) {
      const transitions: Record<string, string[]> = {
        open: ["in_progress"],
        in_progress: ["submitted"],
        submitted: ["closed", "in_progress"],
        closed: [],
      };
      if (!transitions[row.status]?.includes(body.transition))
        throw new Error("指令状态已变化，请刷新后重试");
      if (row.status === "submitted") allowed("manager", "owner");
      else allowed("trainer", "manager");
      row.status = body.transition;
    }
    add("comments", {
      ...body,
      directive_id: row.id,
      author: u.name,
      role: u.role,
      created: new Date().toISOString(),
    });
    return finish({ ok: true }, "反馈指令：" + row.title);
  }
  if (p === "/followups") {
    allowed("trainer", "manager");
    find("employees", body.employee_id);
    checkDay(body.recorded_on);
    requireText(body.encouragement, "鼓励内容");
    requireText(body.correction, "纠正动作");
    files(body.evidence);
    if (
      d.followups.some(
        (f) =>
          f.employee_id === body.employee_id &&
          f.recorded_on === body.recorded_on,
      )
    )
      throw new Error("该员工当日已有跟岗记录，请勿重复提交");
    const row = add("followups", {
      ...body,
      author: u.name,
      created: new Date().toISOString(),
    });
    return finish({ id: row.id }, "记录每日跟岗");
  }
  if (p === "/complaints") {
    allowed("trainer", "manager");
    find("employees", body.employee_id);
    checkDay(body.occurred_on);
    for (const key of [
      "summary",
      "heard",
      "restated",
      "solution",
      "deadline",
      "reported_to",
    ])
      requireText(body[key], "客诉四步及上报记录");
    if (
      typeof body.amount !== "number" ||
      body.amount < 0 ||
      body.amount > 100000
    )
      throw new Error("金额无效");
    const row = add("complaints", {
      ...body,
      approval: "",
      status: body.amount > 50 ? "pending_approval" : "recorded",
      creator: u.name,
      created: new Date().toISOString(),
    });
    return finish({ id: row.id }, "登记客诉：" + row.summary);
  }
  const approve = p.match(/^\/complaints\/(\d+)\/approve$/);
  if (approve) {
    allowed("manager", "owner");
    const row = find("complaints", +approve[1]);
    if (row.status !== "pending_approval")
      throw new Error("当前记录无需重复审批");
    Object.assign(row, {
      status: "approved",
      approval: u.name + " · " + new Date().toISOString(),
    });
    return finish({ ok: true }, "批准客诉处理：" + row.summary);
  }
  throw new Error("此操作需要正式服务器，浏览器试用版暂不支持。");
}
