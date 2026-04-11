import type { Metadata } from "next";
import FmsTemplateUploader from "@/components/templates/FmsTemplateUploader";

export const metadata: Metadata = {
  title: "FMS Template | Tranceed Technology",
  description: "Upload and manage FMS task templates",
};

export default function FmsTemplatePage() {
  return <FmsTemplateUploader />;
}
