import type { Metadata } from "next";
import NewProjectPage from "@/components/templates/NewProjectPage";

export const metadata: Metadata = {
  title: "New Project | Tranceed Technology",
  description: "Create a project from an FMS template",
};

export default function TemplatesNewProjectPage() {
  return <NewProjectPage />;
}
