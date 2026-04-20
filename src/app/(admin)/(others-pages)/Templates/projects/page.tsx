import type { Metadata } from "next";
import ProjectsPage from "@/components/projects/ProjectsPage";

export const metadata: Metadata = {
  title: "Projects | Tranceed Technology",
  description: "Manage projects created from FMS templates",
};

export default function TemplatesProjectsPage() {
  return <ProjectsPage />;
}
