// Renders an AI-drafted email as it would actually look landing in an inbox —
// sender row, subject line, body typography — instead of a bare text dump.
// Purely presentational: the underlying body_html is untouched (still just
// <p>/<strong>, per the deliverability-driven structural rule in the prompt
// files), this only changes how the sandbox displays it.

interface EmailPreviewFrameProps {
  fromName?: string;
  fromAddress?: string;
  to?: string | null;
  subject: string;
  bodyHtml: string;
}

export function EmailPreviewFrame({
  fromName = "Compass Marketing",
  fromAddress = "info@compassmarketing.hu",
  to,
  subject,
  bodyHtml,
}: EmailPreviewFrameProps) {
  const initials =
    fromName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "C";

  return (
    <div className="rounded-xl bg-muted/40 p-3 sm:p-5">
      <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-black/10 bg-white shadow-md">
        <div className="flex items-start gap-3 border-b border-black/5 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-compass-purple text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-gray-900">{fromName}</span>
              <span className="shrink-0 text-xs text-gray-400">most</span>
            </div>
            <div className="truncate text-xs text-gray-500">{fromAddress}</div>
            {to && <div className="mt-0.5 truncate text-xs text-gray-400">Címzett: {to}</div>}
          </div>
        </div>

        <div className="border-b border-black/5 px-4 py-3">
          <div className="text-[15px] font-semibold leading-snug text-gray-900">
            {subject || "(nincs tárgy)"}
          </div>
        </div>

        <div
          className="px-4 py-4 text-[14px] leading-relaxed text-gray-800 [&_a]:text-compass-purple [&_a]:underline [&_p]:my-3 [&_p]:first:mt-0 [&_p]:last:mb-0 [&_strong]:font-semibold [&_strong]:text-gray-900"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </div>
  );
}

export function EmailPreviewSkeleton() {
  return (
    <div className="rounded-xl bg-muted/40 p-3 sm:p-5">
      <div className="mx-auto max-w-xl animate-pulse overflow-hidden rounded-lg border border-black/10 bg-white shadow-md">
        <div className="flex items-start gap-3 border-b border-black/5 px-4 py-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-2.5 w-40 rounded bg-gray-100" />
          </div>
        </div>
        <div className="border-b border-black/5 px-4 py-3">
          <div className="h-3.5 w-2/3 rounded bg-gray-200" />
        </div>
        <div className="space-y-2.5 px-4 py-4">
          <div className="h-2.5 w-full rounded bg-gray-100" />
          <div className="h-2.5 w-11/12 rounded bg-gray-100" />
          <div className="h-2.5 w-4/5 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
