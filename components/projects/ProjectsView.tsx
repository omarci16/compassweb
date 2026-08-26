"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectKanban } from "./ProjectKanban";
import { ProjectTable } from "./ProjectTable";
import type { Project } from "@/lib/types/app.types";
import { Kanban, Table as TableIcon } from "lucide-react";

export function ProjectsView({ projects }: { projects: Project[] }) {
  const [view, setView] = useState<"kanban" | "table">("kanban");

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as never)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="kanban" className="gap-1.5">
          <Kanban className="h-3.5 w-3.5" />
          Kanban
        </TabsTrigger>
        <TabsTrigger value="table" className="gap-1.5">
          <TableIcon className="h-3.5 w-3.5" />
          Table
        </TabsTrigger>
      </TabsList>
      <TabsContent value="kanban">
        <ProjectKanban projects={projects} />
      </TabsContent>
      <TabsContent value="table">
        <ProjectTable projects={projects} />
      </TabsContent>
    </Tabs>
  );
}
