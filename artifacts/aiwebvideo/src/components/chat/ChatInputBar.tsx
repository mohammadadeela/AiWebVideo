import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/app-button';

const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function ChatInputBar({
  placeholder,
  onSubmit,
  disabled,
  multiline = false,
  prefix,
  onFiles,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  prefix?: string;
  onFiles?: (files: File[]) => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submitValue() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitValue();
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitValue();
    }
  }

  function acceptedImages(files: File[]) {
    const accepted: File[] = [];
    let error: string | null = null;
    for (const file of files) {
      if (!CHAT_IMAGE_TYPES.includes(file.type)) {
        error = 'Attach JPEG, PNG, or WEBP images.';
        continue;
      }
      if (file.size > CHAT_IMAGE_MAX_BYTES) {
        error = `${file.name || 'That image'} is larger than 10MB.`;
        continue;
      }
      accepted.push(file);
    }
    setAttachmentError(error);
    return accepted.slice(0, 10);
  }

  function sendFiles(files: File[]) {
    if (!onFiles || disabled) return;
    const accepted = acceptedImages(files);
    if (accepted.length) void onFiles(accepted);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!onFiles || disabled) return;
    const directFiles = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));
    const itemFiles = directFiles.length
      ? []
      : Array.from(event.clipboardData.items ?? [])
          .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));
    const images = directFiles.length ? directFiles : itemFiles;
    if (!images.length) return;
    event.preventDefault();
    sendFiles(images);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (!onFiles || disabled) return;
    event.preventDefault();
    setDragging(false);
    sendFiles(Array.from(event.dataTransfer.files ?? []));
  }

  const fieldClass = `font-utility flex-1 rounded-[22px] border border-white/[.11] bg-white/[.05] px-4 py-3 text-base text-text-primary
    shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-colors placeholder:font-body placeholder:text-text-dim
    focus:border-violet/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/20 disabled:opacity-50`;

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={handleSubmit}
        onDragEnter={(event) => { if (onFiles && !disabled) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (onFiles && !disabled) event.preventDefault(); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={handleDrop}
        className={`relative flex items-end gap-2.5 rounded-[24px] transition ${dragging ? 'ring-2 ring-mint/30' : ''}`}
      >
        {onFiles && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={CHAT_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(event) => {
                sendFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="Attach photos or screenshots"
              title="Attach photos or screenshots"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[.1] bg-white/[.04] text-text-muted transition hover:border-violet/35 hover:bg-violet/[.08] hover:text-white disabled:opacity-50"
            >
              <Paperclip size={17} />
            </button>
          </>
        )}
        {multiline ? (
          <textarea
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            className={`${fieldClass} min-h-24 resize-none leading-relaxed`}
          />
        ) : (
          <div className={`${fieldClass} flex min-w-0 items-center gap-1 p-0 pr-3 focus-within:border-violet/45`}>
            {prefix && <span className="shrink-0 pl-4 text-sm text-violet">{prefix}</span>}
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-text-primary outline-none placeholder:text-text-dim"
            />
          </div>
        )}
        <Button type="submit" variant="primary" size="md" className="shrink-0 rounded-2xl px-5" disabled={disabled || !value.trim()}>
          Send
        </Button>
      </form>
      {onFiles && (
        <p className={`px-1 text-[9px] ${attachmentError ? 'text-amber-300' : 'text-text-dim'}`}>
          {attachmentError ?? 'Paste an image directly, drag it into the chat, or use the attachment button.'}
        </p>
      )}
    </div>
  );
}
