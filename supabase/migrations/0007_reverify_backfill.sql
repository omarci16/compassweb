-- =====================================================================
-- Compass ERP — Lead Scraping 2.0 backfill support (Phase 3)
--
-- Remaps legacy enrichment_status values onto the new, distinct failure modes
-- so "we couldn't look" no longer reads as "their site is empty". Run AFTER the
-- Phase 1 + Phase 2 code is deployed. The re-analysis / re-verification of
-- existing cold leads is driven by the prospecting-backfill-reverify Inngest
-- job (POST /api/prospecting/backfill), not by SQL.
-- =====================================================================

-- The old code collapsed every enrichment failure to 'failed'. That most often
-- meant the crawl didn't complete, so map it to 'crawl_failed'.
update leads
set enrichment_status = 'crawl_failed'
where enrichment_status = 'failed';

-- The verify-pending scan index already exists (0006_site_verification.sql:
-- leads_verify_pending_idx). No additional index needed here.
