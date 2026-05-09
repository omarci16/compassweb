import { NextResponse } from "next/server";
import { isValidPortalToken } from "@/lib/utils/portal-token";
import {
  getInvoices,
  getProjectByPortalToken,
} from "@/lib/data/queries";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  if (!isValidPortalToken(params.token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const project = await getProjectByPortalToken(params.token);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const invoices = await getInvoices({ projectId: project.id });

  // Public-safe shape: never expose internal_notes, internal pricing logic, etc.
  return NextResponse.json({
    client_name: project.client_name,
    client_company: project.client_company,
    package: project.package,
    current_stage: project.current_stage,
    materials_deadline: project.materials_deadline,
    materials_received_at: project.materials_received_at,
    staging_url: project.staging_url,
    launch_url: project.launch_url,
    blueprint_data: project.blueprint_data,
    invoices: invoices.map((i) => ({
      type: i.type,
      amount_huf: i.amount_huf,
      due_at: i.due_at,
      status: i.status,
    })),
  });
}
