import { redirect } from "next/navigation";

export default function WarehouseSettingsRedirectPage() {
  redirect("/inventory/warehouses");
}
