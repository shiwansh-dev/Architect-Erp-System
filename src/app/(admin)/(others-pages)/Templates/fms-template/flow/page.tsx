import type { Metadata } from "next";
import FmsTemplateFlow from "@/components/templates/FmsTemplateFlow";

export const metadata: Metadata = {
  title: "FMS Template Flow | Tranceed Technology",
  description: "Flow editor for FMS template tasks",
};

export default function FmsTemplateFlowPage() {
  return <FmsTemplateFlow />;
}
