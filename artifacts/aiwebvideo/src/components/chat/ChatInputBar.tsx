import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/app-button';

export function ChatInputBar({
  placeholder,
  onSubmit,
  disabled,
  multiline = false,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const [value, setValue] = useState('');

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

  const fieldClass = `font-utility flex-1 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm text-text-primary
    shadow-inner transition-colors placeholder:font-body placeholder:text-text-dim
    focus:border-violet/45 focus-visible:outline-none disabled:opacity-50`;

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`${fieldClass} min-h-24 resize-none leading-relaxed`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={fieldClass}
        />
      )}
      <Button type="submit" variant="primary" size="md" className="shrink-0 rounded-2xl px-5" disabled={disabled || !value.trim()}>
        Send
      </Button>
    </form>
  );
}
