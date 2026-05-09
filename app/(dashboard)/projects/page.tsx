import { getProjects } from "@/lib/data/queries";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Default sort: urgency score, descending. Drag a card to advance a stage —
          the API enforces gates.
        </p>
      </div>
      <ProjectsView projects={projects} />
    </div>
  );
}
