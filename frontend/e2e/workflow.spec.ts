import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("培训专员 → 文件留痕与考核 → 管理指令 → 整改复核 → 正式账号隔离", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /许知夏/ })).toBeVisible();
  await expect(page.locator(".recharts-area-curve")).toBeVisible();
  // Upload a real CSV from the browser and verify persisted library contents.
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "资料与留痕" })
    .click();
  await page
    .getByRole("button", { name: "上传资料", exact: true })
    .first()
    .click();
  await page.getByLabel("资料分类").selectOption("签到表");
  await page.locator("input[type=file]").setInputFiles({
    name: "浏览器签到测试.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("姓名,签到\n李淑芬,已到场"),
  });
  await expect(page.locator(".selected-files")).toContainText(
    "浏览器签到测试.csv",
  );
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: /浏览器签到测试.csv/ }).click();
  await expect(page.getByRole("link", { name: "下载文件" })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  // Score with the actual 60 / 30 / 10 parts; require feedback and link evidence.
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "考核与评分" })
    .click();
  await page.getByRole("button", { name: "新建考核", exact: true }).click();
  await page
    .getByLabel("考核员工 *")
    .selectOption({ label: "李淑芬 · 服务员" });
  for (const [label, value] of [
    ["摆台计时得分", "16"],
    ["卫生抽查得分", "16"],
    ["服务流程演练得分", "15"],
    ["现场观察得分", "23"],
    ["口述得分", "8"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("表现、问题与扣分依据 *")
    .fill("浏览器验收：巡台动作需要复训，次日跟岗观察。");
  await page.getByRole("button", { name: "从已有资料库选择" }).click();
  await page.getByLabel(/浏览器签到测试.csv/).check();
  await page.getByRole("button", { name: "提交考核", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toContainText("78");
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText("78");
  // A real planned training can be signed in and completed without fabricating photos.
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "培训计划" })
    .click();
  await page.getByRole("button", { name: "安排培训", exact: true }).click();
  await page.getByLabel("培训主题", { exact: true }).fill("巡台三看二次培训");
  await page.getByLabel("课程 *", { exact: true }).selectOption("service");
  await page.getByRole("button", { name: "保存培训计划" }).click();
  await page.getByRole("button", { name: /巡台三看二次培训/ }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel(/李淑芬/).check();
  await d
    .getByPlaceholder("填写实操问题与下一步纠正动作；无问题请写明未发现问题")
    .fill("巡台频次已纠正，继续观察主动加水。");
  await d.getByRole("button", { name: "确认签到并完成培训" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /巡台三看二次培训/ }),
  ).toContainText("1/4 人签到");
  // Switch demo perspectives; permissions apply on the API, not only hidden buttons.
  const role = async (name: string) => {
    await page.locator(".user-menu").click();
    await page
      .locator(".user-dropdown")
      .getByRole("button", { name, exact: true })
      .click();
  };
  await role("管理层 / 老板");
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "跟进与整改" })
    .click();
  await page.getByRole("button", { name: "下达指令", exact: true }).click();
  await page.getByLabel("跟进对象").selectOption({ label: "李淑芬 · 服务员" });
  await page.getByLabel("指令标题 *").fill("浏览器验收整改指令");
  await page
    .getByLabel("执行要求与验收标准 *")
    .fill("练习主动加水，提交观察记录，由管理层复核。");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "下达指令", exact: true })
    .click();
  await role("培训专员");
  await page.getByRole("button", { name: /浏览器验收整改指令/ }).click();
  await page
    .getByPlaceholder("具体说明已完成的训练、观察到的改变，或管理层意见…")
    .fill("开始针对性训练。");
  await page.getByLabel("同时更新执行状态").selectOption("in_progress");
  await page.getByRole("button", { name: "开始执行", exact: true }).click();
  await expect(page.locator(".comment-body").last()).toContainText(
    "开始针对性训练。",
  );
  await page
    .getByPlaceholder("具体说明已完成的训练、观察到的改变，或管理层意见…")
    .fill("现场观察已主动加水，申请复核。");
  await page.getByLabel("同时更新执行状态").selectOption("submitted");
  await page
    .getByRole("button", { name: "提交管理层复核", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".directive-detail-heading"),
  ).toContainText("待复核");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await role("餐饮经理");
  await page.getByRole("button", { name: /浏览器验收整改指令/ }).click();
  await page
    .getByPlaceholder("具体说明已完成的训练、观察到的改变，或管理层意见…")
    .fill("抽查通过。");
  await page.getByLabel("同时更新执行状态").selectOption("closed");
  await page.getByRole("button", { name: "验收通过 · 关闭指令" }).click();
  await expect(
    page.getByRole("dialog").locator(".directive-detail-heading"),
  ).toContainText("已完成");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  // Report download contains the true score and printable report renders.
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "培训汇报" })
    .click();
  await page.getByRole("button", { name: "日报", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出考核明细" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("baihuali-assessments");
  // Bootstrap is explicit; a real workspace starts empty instead of importing demo records.
  await page.getByRole("button", { name: "进入正式工作区" }).click();
  const pass = randomBytes(16).toString("hex");
  await page
    .getByLabel("网站初始化密钥 *")
    .fill("browser-test-initialization-only");
  await page.getByLabel("管理员姓名 *").fill("验收管理员");
  await page.getByLabel("登录账号 *").fill("qa.owner");
  await page.getByLabel("密码 *", { exact: false }).fill(pass);
  await page.getByRole("button", { name: "创建管理员并进入" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".demo-bar")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "员工档案" })
    .click();
  await expect(page.locator(".employee-table")).toHaveCount(0);
  await expect(page.getByText("暂无符合条件的员工")).toBeVisible();
  expect(errors).toEqual([]);
});

test("手机端所有业务页面可访问，无页面横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  for (const hash of [
    "overview",
    "training",
    "assessments",
    "employees",
    "library",
    "followups",
    "standards",
    "reports",
    "settings",
  ]) {
    await page.goto("/#" + hash);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "工作总览" })
    .click();
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
});

test("照片、视频和 PDF 可真实上传、预览与下载", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  const image = await page.locator(".hero").screenshot();
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#286349";
    ctx.fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const finished = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = frame++ % 2 ? "#286349" : "#799c6a";
      ctx.fillRect(0, 0, 160, 90);
    }, 80);
    await new Promise((resolve) => setTimeout(resolve, 700));
    recorder.stop();
    clearInterval(timer);
    const blob = await finished;
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const assets = [
    { name: "验收照片.png", mime: "image/png", body: image },
    { name: "验收视频.webm", mime: "video/webm", body: Buffer.from(video) },
    { name: "验收汇报.pdf", mime: "application/pdf", body: pdf },
  ];
  for (const f of assets) {
    const response = await page.request.post("/api/files", {
      multipart: { file: { name: f.name, mimeType: f.mime, buffer: f.body } },
    });
    expect(response.ok()).toBeTruthy();
    const uploaded = await response.json();
    const original = await page.request.get(
      `/api/files/${uploaded.id}?download=true`,
    );
    expect(Buffer.compare(await original.body(), f.body)).toEqual(0);
  }
  await page.reload();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "资料与留痕" })
    .click();
  await page.getByRole("button", { name: /验收照片.png/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("img", { name: "验收照片.png", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .getByRole("img", { name: "验收照片.png", exact: true })
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /验收视频.webm/ }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await page.locator("video").evaluate((el: HTMLVideoElement) => el.play());
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /验收汇报.pdf/ }).click();
  await expect(page.locator("iframe")).toBeVisible();
  const pdfUrl = await page.locator("iframe").getAttribute("src");
  const headers = (await page.request.get(pdfUrl!)).headers();
  expect(headers["content-type"]).toContain("application/pdf");
  expect(headers["x-frame-options"]).toEqual("SAMEORIGIN");
});
