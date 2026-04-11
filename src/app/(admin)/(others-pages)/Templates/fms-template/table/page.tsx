import type { Metadata } from "next";
import FmsTemplateTable from "@/components/templates/FmsTemplateTable";

export const metadata: Metadata = {
  title: "FMS Template Table | Tranceed Technology",
  description: "Spreadsheet-style FMS template viewer",
};

export default function FmsTemplateTablePage() {
  return <FmsTemplateTable />;
}
