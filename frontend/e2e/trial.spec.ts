import { test, expect } from "@playwright/test";

test("免费浏览器试用：评分、附件持久化、角色整改闭环、报表、本机隔离与重置", async ({
  page,
  browser,
}) => {
  const errors: string[] = [],
    apiRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      apiRequests.push(r.url());
  });
  await page.goto("./");
  await expect(page.locator(".demo-bar")).toContainText("本机试用");
  const nav = (name: string) =>
    page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("button", { name })
      .click();
  const role = async (name: string) => {
    await page.locator(".user-menu").click();
    await page
      .locator(".user-dropdown")
      .getByRole("button", { name, exact: true })
      .click();
  };
  await nav("员工档案");
  await page.getByRole("button", { name: "添加员工", exact: true }).click();
  await page.getByLabel("员工姓名 *").fill("浏览器试用员工");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "添加员工", exact: true })
    .click();
  await expect(page.locator("tbody")).toContainText("浏览器试用员工");
  await nav("考核与评分");
  await page.getByRole("button", { name: "新建考核", exact: true }).click();
  await page
    .getByLabel("考核员工 *")
    .selectOption({ label: "浏览器试用员工 · 服务员" });
  for (const [name, n] of [
    ["摆台计时得分", "16"],
    ["卫生抽查得分", "16"],
    ["服务流程演练得分", "15"],
    ["现场观察得分", "23"],
    ["口述得分", "8"],
  ])
    await page.getByLabel(name, { exact: true }).fill(n);
  await page
    .getByLabel("表现、问题与扣分依据 *")
    .fill("试用验收：巡台动作需再示范一次。");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "试用签到.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("姓名,签到\n浏览器试用员工,已到场"),
    });
  await expect(page.locator(".selected-files")).toContainText("试用签到.csv");
  await page.getByRole("button", { name: "提交考核", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toContainText("78");
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText("78");
  await nav("资料与留痕");
  await page.getByRole("button", { name: /试用签到.csv/ }).click();
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载文件" }).click();
  expect((await csv).suggestedFilename()).toEqual("试用签到.csv");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  // Native Blob image previews are rehydrated from IndexedDB after a reload.
  await nav("工作总览");
  const image = await page.locator(".hero").screenshot();
  await nav("资料与留痕");
  await page.getByRole("button", { name: "上传资料", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "试用照片.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(page.locator(".selected-files")).toContainText("试用照片.png");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /试用照片.png/ }).click();
  await expect
    .poll(() =>
      page
        .getByRole("dialog")
        .getByRole("img", { name: "试用照片.png", exact: true })
        .evaluate((e: HTMLImageElement) => e.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await role("管理层 / 老板");
  await nav("跟进与整改");
  await page.getByRole("button", { name: "下达指令", exact: true }).click();
  await page.getByLabel("指令标题 *").fill("本机试用整改");
  await page
    .getByLabel("执行要求与验收标准 *")
    .fill("练习巡台三看并提交复核。");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "下达指令", exact: true })
    .click();
  await role("培训专员");
  await page.getByRole("button", { name: /本机试用整改/ }).click();
  const feedback = page.getByPlaceholder(
    "具体说明已完成的训练、观察到的改变，或管理层意见…",
  );
  await feedback.fill("已经开始练习。");
  await page.getByLabel("同时更新执行状态").selectOption("in_progress");
  await page.getByRole("button", { name: "开始执行", exact: true }).click();
  await expect(page.locator(".comment-body").last()).toContainText(
    "已经开始练习。",
  );
  await feedback.fill("训练完成，申请验收。");
  await page.getByLabel("同时更新执行状态").selectOption("submitted");
  await page
    .getByRole("button", { name: "提交管理层复核", exact: true })
    .click();
  await expect(page.locator(".directive-detail-heading")).toContainText(
    "待复核",
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await role("餐饮经理");
  await page.getByRole("button", { name: /本机试用整改/ }).click();
  await feedback.fill("抽查通过。");
  await page.getByLabel("同时更新执行状态").selectOption("closed");
  await page.getByRole("button", { name: "验收通过 · 关闭指令" }).click();
  await expect(page.locator(".directive-detail-heading")).toContainText(
    "已完成",
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await nav("培训汇报");
  const report = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出考核明细" }).click();
  expect((await report).suggestedFilename()).toContain("baihuali-assessments");
  // Another browser is an isolated trial, not a shared employee workspace.
  const separate = await browser.newContext();
  const other = await separate.newPage();
  await other.goto("http://127.0.0.1:8003/canyinfuwukaohexitong/#employees");
  await expect(other.locator("tbody")).not.toContainText("浏览器试用员工");
  await separate.close();
  await page.getByRole("button", { name: "试用说明", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "手机与电脑的数据不共享",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "重置试用数据", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav("员工档案");
  await expect(page.locator("tbody")).not.toContainText("浏览器试用员工");
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("子目录托管的手机试用页无 API 依赖、标准原文可下载", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.locator(".hero")).toBeVisible();
  for (const name of [
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
    await page.goto("./#" + name);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page.goto("./#standards");
  const source = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载原计划书" }).click();
  expect((await source).suggestedFilename()).toContain(".docx");
});
