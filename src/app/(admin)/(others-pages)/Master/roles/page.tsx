import type { Metadata } from "next";
import RolesPage from "@/components/master/RolesPage";

export const metadata: Metadata = {
  title: "Roles | Tranceed Technology",
  description: "Manage owner role codes used by FMS templates",
};

export default function MasterRolesPage() {
  return <RolesPage />;
}
