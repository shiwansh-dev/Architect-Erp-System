import type { Metadata } from "next";
import ProjectDetailPage from "@/components/projects/ProjectDetailPage";

export const metadata: Metadata = {
  title: "Project Details | Tranceed Technology",
  description: "View project tasks in table and flow formats",
};

export default async function TemplatesProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailPage projectId={id} />;
}
