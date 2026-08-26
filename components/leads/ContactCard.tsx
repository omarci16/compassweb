// Contact card — every channel we know for a lead, and where each came from.
//
// Phase I harvests emails/phones/socials out of HTML the pipeline already
// downloads. This surfaces that: the primary address with its provenance and
// verification state, the alternates a human can switch to without a re-scrape,
// and any social profile — which for a lead with no usable email is the only
// way to reach them at all (`instagram_dm` is a first-class lead source).

import { Facebook, Globe, Instagram, Linkedin, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ContactSource,
  EmailStatus,
  SocialLinks,
} from "@/lib/types/app.types";
import type { DiscoveredEmail } from "@/lib/prospecting/contact-extract";

const SOURCE_LABEL: Record<ContactSource, string> = {
  gmaps: "Google Maps",
  website: "weboldalról",
  manual: "kézzel",
};

const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  valid: "ellenőrzött",
  risky: "kockázatos",
  invalid: "érvénytelen",
  unknown: "ismeretlen",
};

const EMAIL_STATUS_VARIANT: Record<
  EmailStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  valid: "default",
  risky: "secondary",
  invalid: "destructive",
  unknown: "outline",
};

const SOCIAL_META: {
  key: keyof SocialLinks;
  label: string;
  icon: typeof Instagram;
}[] = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
];

export function ContactCard({
  email,
  phone,
  websiteUrl,
  emailStatus,
  contactSource,
  discoveredEmails,
  discoveredPhones,
  socialLinks,
}: {
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  emailStatus: EmailStatus | null;
  contactSource: ContactSource | null;
  discoveredEmails: DiscoveredEmail[];
  discoveredPhones: string[];
  socialLinks: SocialLinks | null;
}) {
  const alternates = discoveredEmails.filter((e) => e.email !== email);
  const extraPhones = discoveredPhones.filter((p) => p !== phone);
  const socials = SOCIAL_META.map((s) => ({ ...s, url: socialLinks?.[s.key] })).filter(
    (s): s is typeof s & { url: string } => Boolean(s.url),
  );
  const reachable = Boolean((email && emailStatus !== "invalid") || socials.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Kapcsolat</CardTitle>
        <Badge variant={reachable ? "default" : "outline"} className="text-[10px]">
          {reachable ? "elérhető" : "nincs csatorna"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Primary email + provenance + verification */}
        <div className="flex items-start gap-2.5 text-sm">
          <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Email
            </div>
            {email ? (
              <>
                <a
                  href={`mailto:${email}`}
                  className="text-foreground hover:text-primary hover:underline truncate block"
                >
                  {email}
                </a>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {emailStatus && (
                    <Badge
                      variant={EMAIL_STATUS_VARIANT[emailStatus]}
                      className="text-[10px]"
                    >
                      {EMAIL_STATUS_LABEL[emailStatus]}
                    </Badge>
                  )}
                  {contactSource && (
                    <span className="text-[10px] text-muted-foreground">
                      {SOURCE_LABEL[contactSource]}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Alternates found on the site — switchable without a re-scrape */}
        {alternates.length > 0 && (
          <div className="pl-6 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              További találatok
            </div>
            {alternates.map((alt) => (
              <div key={alt.email} className="flex items-center gap-1.5 text-xs">
                <a
                  href={`mailto:${alt.email}`}
                  className="text-muted-foreground hover:text-primary hover:underline truncate"
                >
                  {alt.email}
                </a>
                {alt.own_domain && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    saját domain
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <ContactRow
          icon={Phone}
          label="Telefon"
          value={phone}
          link={phone ? `tel:${phone.replace(/\s/g, "")}` : undefined}
        />

        {extraPhones.length > 0 && (
          <div className="pl-6 space-y-1">
            {extraPhones.map((p) => (
              <a
                key={p}
                href={`tel:${p.replace(/\s/g, "")}`}
                className="block text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                {p}
              </a>
            ))}
          </div>
        )}

        <ContactRow
          icon={Globe}
          label="Weboldal"
          value={websiteUrl}
          link={websiteUrl ?? undefined}
        />

        {/* Social profiles = the DM channel when email fails */}
        {socials.length > 0 && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Közösségi profilok
            </div>
            <div className="flex flex-wrap gap-1.5">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  <s.icon className="h-3 w-3" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {value ? (
          link ? (
            <a
              href={link}
              className="text-foreground hover:text-primary hover:underline truncate block"
              target="_blank"
              rel="noreferrer"
            >
              {value}
            </a>
          ) : (
            <span className="text-foreground truncate block">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
