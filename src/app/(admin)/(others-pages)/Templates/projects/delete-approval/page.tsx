import type { Metadata } from "next";
import ProjectDeleteApprovalPage from "@/components/projects/ProjectDeleteApprovalPage";

export const metadata: Metadata = {
  title: "Project Delete Approval | Tranceed Technology",
  description: "Approve or restore project deletion requests",
};

export default function TemplatesProjectDeleteApprovalPage() {
  return <ProjectDeleteApprovalPage />;
}
