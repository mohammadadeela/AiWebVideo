import { StudioChoiceHint, StudioToolCards } from '@/components/studio/StudioToolCards';

export function StudioShowcase() {
  return (
    <section id="studio" className="border-t border-border bg-black/10">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <p className="font-utility text-xs uppercase tracking-[.18em] text-mint">New — beyond website videos</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-text-primary sm:text-3xl">Three more ways to create with AI</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-text-muted">
            Same AI video engine, no website required. Upload photos or just write your idea — see how it works for free, generate with an account and credits.
          </p>
          <div className="mt-5 flex justify-center"><StudioChoiceHint /></div>
        </div>
        <StudioToolCards detailed />
      </div>
    </section>
  );
}
