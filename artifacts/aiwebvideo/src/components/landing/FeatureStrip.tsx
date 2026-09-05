const FEATURES = [
  {
    title: 'Loaded pages, not rushed snapshots',
    body: "We wait for fonts, images, and network activity, then capture multiple real pages and a smooth-scroll recording.",
    icon: <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Zm12 3.2 4.15-2.6a.6.6 0 0 1 .85.55v9.7a.6.6 0 0 1-.85.55L16 15.3" />,
  },
  {
    title: 'AI photo sets',
    body: 'On-brand marketing photos generated from your real pages — not generic stock. Perfect for ads and social.',
    icon: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5a1.5 1.5 0 0 1 2.12 0L14 16m2-2 1.38-1.38a1.5 1.5 0 0 1 2.12 0L20 13" /></>,
  },
  {
    title: 'Professional delivery formats',
    body: 'Choose landscape or portrait, with 1080p or 4K mastered delivery. Eight-second Veo generations can be native at the selected size; longer continuous films use Veo continuity extension before final mastering.',
    icon: <><rect x="4" y="4" width="9" height="9" rx="1.5" /><path d="M17 8v9a2 2 0 0 1-2 2H8" /></>,
  },
  {
    title: 'Chat interface',
    body: 'No forms, no briefs. Tell the AI what you want in plain language. It asks the right questions.',
    icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  },
  {
    title: 'Brand extraction',
    body: "We pull your colors, logo, and fonts automatically so every output looks like it came from your design team.",
    icon: <><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></>,
  },
  {
    title: 'Clear per-second billing',
    body: 'One credit equals one generated video second. Failed scenes are refunded and paid-plan credits roll over.',
    icon: <><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" /><path d="M12 6v6l4 2" /></>,
  },
];

export function FeatureStrip() {
  return (
    <section id="how-it-works" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold text-text-primary">Built different</h2>
          <p className="mt-2 text-sm text-text-muted max-w-lg mx-auto">
            Every other tool uses templates. We capture your real site and turn it into professional content.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-panel p-3 sm:p-5 hover:border-violet/40 transition-all duration-200 hover:-translate-y-0.5 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-2 sm:mb-3.5 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-violet/15">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-violet sm:h-[17px] sm:w-[17px]"
                  aria-hidden="true"
                >
                  {f.icon}
                </svg>
              </div>
              <h3 className="font-display text-xs sm:text-base font-bold text-text-primary leading-snug">{f.title}</h3>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-sm leading-relaxed text-text-muted line-clamp-3 sm:line-clamp-none">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
