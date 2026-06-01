// Cold outreach HTML wrapper. The AI-drafted body is inserted as-is; we
// only add the surrounding shell, the inline visuals, and a small footer.
// Email clients are unforgiving — keep everything table/inline-style based
// and avoid web fonts. The visuals are referenced by absolute https URLs
// from Supabase Storage (no CID inlining = better Gmail behaviour).

export interface ColdOutreachHtmlOptions {
  /** Body HTML produced by the AI — already contains <p> tags. */
  bodyHtml: string;
  /** Public https URLs of the visual concept image(s), in display order. */
  visualUrls: string[];
  /** Alt text for the images (e.g. "{Company} — koncepció"). */
  visualAlt: string;
}

export function renderColdOutreachHtml({
  bodyHtml,
  visualUrls,
  visualAlt,
}: ColdOutreachHtmlOptions): string {
  const visualsBlock = visualUrls.length === 0
    ? ""
    : visualUrls
        .map(
          (url) => `
        <tr>
          <td style="padding: 16px 0;">
            <img
              src="${escapeAttr(url)}"
              alt="${escapeAttr(visualAlt)}"
              style="display:block; width:100%; max-width:560px; height:auto; border-radius:8px; border:1px solid #e5e7eb;"
            />
          </td>
        </tr>`,
        )
        .join("\n");

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Compass Marketing</title>
</head>
<body style="margin:0; padding:0; background:#f6f6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f4;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:12px; border:1px solid #ececec;">
          <tr>
            <td style="padding: 28px 32px 8px 32px;">
              <div style="font-size:14px; font-weight:600; letter-spacing:0.08em; color:#534AB7; text-transform:uppercase;">Compass Marketing</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 32px 4px 32px; font-size:15px; line-height:1.65; color:#1f2937;">
              ${bodyHtml}
            </td>
          </tr>
          ${visualsBlock ? `<tr><td style="padding: 8px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${visualsBlock}</table></td></tr>` : ""}
          <tr>
            <td style="padding: 8px 32px 28px 32px;">
              <hr style="border:none; border-top:1px solid #ececec; margin:16px 0;" />
              <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280;">
                Compass Marketing Kft. · Budapest, Magyarország<br />
                <a href="mailto:info@compassmarketing.hu" style="color:#534AB7; text-decoration:none;">info@compassmarketing.hu</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
