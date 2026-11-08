import { useState } from "react";
import { AlertCircle, Check, RotateCcw, ExternalLink } from "lucide-react";
import { useApp } from "../context";
import { post } from "../api";
export function TrialInfo() {
  const { close, toast, refresh, setUser, go } = useApp();
  const [resetting, setResetting] = useState(false);
  return (
    <>
      <div className="alert neutral">
        <AlertCircle size={20} />
        <p>
          你正在体验免费个人试用版，无需注册。可以切换三种角色，测试上传、评分、培训、整改和汇报。
        </p>
      </div>
      <div className="text-box">
        <strong>试用数据保存在你的浏览器中</strong>
        <p>
          刷新网页后会保留。手机与电脑的数据不共享，清理浏览器网站数据会删除评分与文件。请使用虚构员工和测试资料。
        </p>
        <strong>正式版使用服务器保存和共享数据</strong>
        <p>
          确认功能满意后，再部署正式版。正式版提供真实账号、服务器权限校验、多人共享和服务端文件保存。试用版的角色切换只用于体验流程，不代表真实账号登录。
        </p>
      </div>
      <div className="form-actions">
        <button
          className="btn"
          disabled={resetting}
          onClick={async () => {
            if (
              !confirm(
                "将清空此浏览器的全部试用评分与文件，恢复最初的示例。确认重置？",
              )
            )
              return;
            setResetting(true);
            try {
              const u = await post("/trial/reset", {});
              setUser(u);
              await refresh();
              toast("已恢复初始试用数据");
              go("overview");
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setResetting(false);
            }
          }}
        >
          <RotateCcw size={15} />
          重置试用数据
        </button>
        <button className="btn primary" onClick={close}>
          <Check size={16} />
          继续试用
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 20 }}>
        <a
          className="text-button"
          href="https://github.com/zhangheng060125/canyinfuwukaohexitong/blob/main/docs/上线部署.md"
          target="_blank"
          rel="noreferrer"
        >
          查看正式上线说明 <ExternalLink size={13} />
        </a>
      </p>
    </>
  );
}
