import { useEffect, useRef, useState, useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import {
  X,
  UploadCloud,
  FileText,
  Film,
  Image as ImageIcon,
  Check,
  Download,
  FolderOpen,
  LoaderCircle,
  Paperclip,
  ChevronRight,
  Search,
} from "lucide-react";
import { useApp } from "./context";
import { api, fileSize } from "./api";
import type { Asset } from "./types";

export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <i />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  size = "md",
  index = 0,
}: {
  name: string;
  size?: string;
  index?: number;
}) {
  return (
    <span className={`avatar ${size} color-${index % 5}`}>
      {name.slice(-2)}
    </span>
  );
}
export function Empty({
  title = "暂无记录",
  text = "从第一条真实记录开始，让每一步成长都有迹可循。",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <FolderOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="title-actions">{actions}</div>
    </div>
  );
}
export function Modal({
  title,
  sub,
  wide = false,
  children,
  onClose,
}: {
  title: string;
  sub?: string;
  wide?: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const nodes = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,a[href],[tabindex="0"]',
          ),
        ).filter((n) => !n.hasAttribute("disabled"));
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  full = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}) {
  const id=useId();
  return (
    <label className={"field " + (full ? "full" : "")}>
      <span id={id}>{label}</span>
      {isValidElement(children) ? cloneElement(children as ReactElement<any>, {"aria-labelledby":id}) : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "搜索员工、课程或记录…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="icon-btn"
          aria-label="清空搜索"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
export function SaveButton({
  busy,
  children = "保存记录",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="btn primary" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{" "}
      {busy ? "正在保存…" : children}
    </button>
  );
}
export function FileIcon({ file, size = 22 }: { file: Asset; size?: number }) {
  return file.mime.startsWith("image/") ? (
    <ImageIcon size={size} />
  ) : file.mime.startsWith("video/") ? (
    <Film size={size} />
  ) : (
    <FileText size={size} />
  );
}
export function Attachments({ ids }: { ids: number[] }) {
  const { data, open } = useApp();
  return (
    <div className="attachments">
      {ids.map((id) => {
        const f = data.files.find((f) => f.id === id);
        return f ? (
          <button
            type="button"
            className="attachment"
            key={id}
            onClick={() => open({ type: "file", data: f })}
          >
            <Paperclip size={14} />
            {f.name}
            <ChevronRight size={13} />
          </button>
        ) : null;
      })}
    </div>
  );
}
export function UploadPicker({
  value,
  onChange,
  category = "培训资料",
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  category?: string;
}) {
  const { data, refresh, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(files: FileList | File[] | null) {
    if (!files?.length) return;
    setBusy(true);
    const ids: number[] = [];
    try {
      for (const f of Array.from(files)) {
        if (f.size > 100 * 1024 * 1024)
          throw new Error(f.name + " 超过 100 MB");
        const fd = new FormData();
        fd.append("file", f);
        const r = await api("/files?category=" + encodeURIComponent(category), {
          method: "POST",
          body: fd,
        });
        ids.push(r.id);
      }
      toast("附件已上传");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      await refresh();
      onChange([...value, ...ids]);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="upload-picker">
      <div
        className={"dropzone " + (busy ? "uploading" : "")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) upload(e.dataTransfer.files);
        }}
      >
        <span className="upload-symbol">
          {busy ? (
            <LoaderCircle className="spin" size={23} />
          ) : (
            <UploadCloud size={24} />
          )}
        </span>
        <div>
          <strong>
            {busy ? (
              "正在上传文件…"
            ) : (
              <>
                拖拽文件到此处，或{" "}
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  点击上传
                </button>
              </>
            )}
          </strong>
          <p>照片、视频、Word、PDF、Excel、CSV · 单个文件 ≤ 100 MB</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        />
      </div>
      <button
        className="text-button small"
        type="button"
        onClick={() => setLibrary(!library)}
      >
        <FolderOpen size={14} /> {library ? "收起资料库" : "从已有资料库选择"}
      </button>
      {library && (
        <div className="file-select">
          {data.files.length === 0 ? (
            <p className="muted">资料库还没有文件</p>
          ) : (
            data.files.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={value.includes(f.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...value, f.id]
                        : value.filter((v) => v !== f.id),
                    )
                  }
                />
                <FileIcon file={f} size={15} />
                <span>{f.name}</span>
                <small>{fileSize(f.size)}</small>
              </label>
            ))
          )}
        </div>
      )}
      {value.length > 0 && (
        <div className="selected-files">
          {value.map((id) => {
            const f = data.files.find((f) => f.id === id);
            return (
              <div key={id}>
                <Paperclip size={14} />
                <span>{f?.name || "附件 #" + id}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="移除附件"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function FilePreview({ file }: { file: Asset }) {
  return (
    <div className="file-preview">
      {file.mime.startsWith("image/") ? (
        <img src={"/api/files/" + file.id} alt={file.name} />
      ) : file.mime.startsWith("video/") ? (
        <video src={"/api/files/" + file.id} controls preload="metadata" />
      ) : file.mime === "application/pdf" ? (
        <iframe src={"/api/files/" + file.id} title={file.name} />
      ) : (
        <div className="document-placeholder">
          <FileIcon file={file} size={50} />
          <h3>{file.name}</h3>
          <p>下载后可使用 Word / Excel 等应用打开</p>
        </div>
      )}
      <div className="file-meta">
        <span>
          {fileSize(file.size)} · {file.uploader} 上传
        </span>
        <a
          href={"/api/files/" + file.id + "?download=true"}
          className="btn primary"
        >
          <Download size={16} /> 下载文件
        </a>
      </div>
    </div>
  );
}
