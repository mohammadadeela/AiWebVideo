/** Shown while a page's code loads. Deliberately quiet: the mark and a thin moving line. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg" role="status" aria-label={label}>
      <div className="flex flex-col items-center gap-5">
        <img src="/logo.svg" alt="" width={40} height={40} className="h-10 w-10" />
        <span className="page-loader-track" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
