import { TRIAL } from "./mode";
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (TRIAL) return (await import("./trial/api")).trialRequest(path, options);
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "操作失败，请重试";
    try {
      const d = await response.json();
      message =
        typeof d.detail === "string"
          ? d.detail
          : "请检查表单输入是否完整、格式是否正确";
    } catch {
      message = `请求失败（${response.status}）`;
    }
    throw new Error(message);
  }
  return response.json();
}
export const post = (path: string, body: any) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
export const fmtDate = (date: string) => date.slice(0, 10).replaceAll("-", ".");
export const shortDate = (date: string) => date.slice(5, 10).replace("-", "/");
export const fileSize = (n: number) =>
  n >= 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : Math.max(1, Math.round(n / 1024)) + " KB";
export const dateAdd = (d: string, n: number) => {
  const t = new Date(d + "T12:00:00+08:00");
  t.setDate(t.getDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(
    t,
  );
};
