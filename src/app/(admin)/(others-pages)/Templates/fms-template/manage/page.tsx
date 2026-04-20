import type { Metadata } from "next";
import FmsTemplateManagePage from "@/components/templates/FmsTemplateManagePage";

export const metadata: Metadata = {
  title: "Manage Templates | Tranceed Technology",
  description: "View, edit, and archive FMS templates",
};

export default function TemplatesManagePage() {
  return <FmsTemplateManagePage />;
}
