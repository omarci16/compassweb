import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import type { TechStack } from "@/lib/types/app.types";

export function TechStackBadges({ tech }: { tech: TechStack }) {
  const cmsLabel = tech.cms
    ? CMS_LABELS[tech.cms] ?? tech.cms
    : "Egyedi / ismeretlen";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">CMS: {cmsLabel}</Badge>
        {tech.ecommerce && (
          <Badge variant="outline">Webshop: {tech.ecommerce}</Badge>
        )}
        {tech.booking && (
          <Badge variant="success">Foglalás: {tech.booking}</Badge>
        )}
        {tech.analytics.length > 0 ? (
          tech.analytics.map((a) => (
            <Badge key={a} variant="info">
              {ANALYTICS_LABELS[a] ?? a}
            </Badge>
          ))
        ) : (
          <Badge variant="destructive">Nincs analitika</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-sm">
        <Capability label="HTTPS" on={tech.has_https} />
        <Capability label="Mobil viewport" on={tech.has_viewport_meta} />
        <Capability label="Schema.org" on={tech.has_schema_org} />
        <Capability label="Open Graph" on={tech.has_open_graph} />
        <Capability label="Blog" on={tech.has_blog} />
        <Capability label="Kapcsolat form" on={tech.has_contact_form} />
      </div>
    </div>
  );
}

function Capability({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {on ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-compass-green" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
      )}
      <span className={on ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

const CMS_LABELS: Record<NonNullable<TechStack["cms"]>, string> = {
  wordpress: "WordPress",
  wix: "Wix",
  squarespace: "Squarespace",
  webflow: "Webflow",
  shopify: "Shopify",
  joomla: "Joomla",
  drupal: "Drupal",
  custom: "Custom",
};

const ANALYTICS_LABELS: Record<TechStack["analytics"][number], string> = {
  ga4: "GA4",
  gtm: "GTM",
  meta_pixel: "Meta Pixel",
  hotjar: "Hotjar",
  matomo: "Matomo",
  linkedin_insight: "LinkedIn Insight",
};
