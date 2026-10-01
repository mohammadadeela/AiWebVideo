import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, ShieldCheck, User } from 'lucide-react';

/**
 * A person's role, shown as what it is ("Administrator" or "Customer") instead of an unlabeled switch.
 * Changing it is a two-step action with a plain-language confirmation, and the pill confirms the change
 * for a few seconds afterwards.
 */
export function RoleControl({ email, isAdmin, isSelf, isOnlyAdmin, busy, justChanged, onChange }: {
  email: string;
  isAdmin: boolean;
  isSelf: boolean;
  isOnlyAdmin: boolean;
  busy: boolean;
  /** True for a few seconds right after this person's role was changed. */
  justChanged: boolean;
  onChange: (makeAdmin: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);

  useEffect(() => { if (!open) setPending(null); }, [open]);

  const cannotDemote = isAdmin && (isSelf || isOnlyAdmin);
  const demoteReason = isSelf && isAdmin
    ? "You can't remove your own administrator access."
    : isOnlyAdmin && isAdmin
      ? 'This is the last administrator.'
      : null;

  const options: Array<{ admin: boolean; title: string; text: string }> = [
    { admin: true, title: 'Administrator', text: 'Can manage users, productions, homepage and settings.' },
    { admin: false, title: 'Customer', text: 'A normal account with no admin access.' },
  ];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={`Role of ${email}: ${isAdmin ? 'Administrator' : 'Customer'}. Change role`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full pl-2.5 pr-2 text-xs font-semibold transition disabled:opacity-50 ${
            justChanged
              ? 'bg-mint/15 text-mint ring-1 ring-mint/50'
              : isAdmin
                ? 'bg-violet/20 text-violet ring-1 ring-violet/40 hover:bg-violet/30'
                : 'bg-white/[.06] text-text-muted hover:bg-white/10 hover:text-white'
          }`}
        >
          {justChanged ? <Check size={13} /> : isAdmin ? <ShieldCheck size={13} /> : <User size={13} />}
          {justChanged ? 'Updated' : isAdmin ? 'Admin' : 'Customer'}
          <ChevronDown size={12} className="opacity-60" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label={`Role for ${email}`}
          className="z-[100] w-[min(92vw,320px)] rounded-2xl border border-white/10 bg-[#161026]/[.98] p-2 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)] backdrop-blur-xl"
        >
          {pending === null ? (
            <>
              <p className="truncate px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-white/50">Role for {email}</p>
              {options.map((option) => {
                const current = option.admin === isAdmin;
                const blocked = !option.admin && cannotDemote;
                return (
                  <button
                    key={option.title}
                    type="button"
                    disabled={current || blocked}
                    onClick={() => setPending(option.admin)}
                    className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${current ? 'bg-white/[.06]' : 'hover:bg-white/[.06]'} disabled:cursor-default disabled:opacity-100`}
                  >
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${option.admin ? 'bg-violet/20 text-violet' : 'bg-white/[.07] text-white/70'}`}>
                      {option.admin ? <ShieldCheck size={16} /> : <User size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        {option.title}
                        {current && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">Current</span>}
                      </span>
                      <span className={`mt-0.5 block text-[11px] leading-4 ${blocked ? 'text-amber-200' : 'text-white/45'}`}>
                        {blocked && demoteReason ? demoteReason : option.text}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="p-2.5">
              <p className="text-[13px] font-semibold">
                {pending ? 'Make this person an administrator?' : 'Remove administrator access?'}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/55">
                {pending
                  ? `${email} will be able to manage users, productions, the homepage and settings.`
                  : `${email} will become a normal customer and lose access to the admin area.`}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setPending(null)} className="h-10 flex-1 rounded-xl bg-white/[.07] text-xs font-semibold text-white transition hover:bg-white/[.12]">Cancel</button>
                <button
                  type="button"
                  onClick={() => { const next = pending; setOpen(false); onChange(next); }}
                  className={`h-10 flex-1 rounded-xl text-xs font-semibold text-white transition ${pending ? 'bg-violet hover:bg-violet/90' : 'bg-pink/80 hover:bg-pink'}`}
                >
                  {pending ? 'Make administrator' : 'Remove access'}
                </button>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
