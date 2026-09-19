import Link from "next/link";
import {
  Store,
  Users,
  Receipt,
  FileText,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Monitor,
  Warehouse,
  Bell,
  Archive,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

const SETTINGS_GROUPS = [
  {
    title: "Business",
    items: [
      { label: "Business profile", href: "/settings/business", icon: Store, available: true },
      { label: "Users & roles", href: "/settings/users", icon: Users, available: true },
      { label: "Warehouses", href: "/settings/warehouses", icon: Warehouse, available: false },
    ],
  },
  {
    title: "Billing & tax",
    items: [
      { label: "Tax", href: "/settings/tax", icon: Receipt, available: true },
      { label: "Invoice", href: "/settings/invoice", icon: FileText, available: true },
      { label: "Payments", href: "/settings/payments", icon: Wallet, available: true },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Inventory", href: "/settings/inventory", icon: Boxes, available: false },
      { label: "Sales", href: "/settings/sales", icon: ShoppingCart, available: true },
      { label: "Purchase", href: "/settings/purchase", icon: ShoppingBag, available: true },
      { label: "Counters", href: "/settings/counters", icon: Monitor, available: false },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Notifications", href: "/settings/notifications", icon: Bell, available: false },
      { label: "Backup", href: "/settings/backup", icon: Archive, available: false },
      { label: "System", href: "/settings/system", icon: Settings, available: true },
    ],
  },
];

export default function SettingsOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your business and platform."
      />
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.available ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Later</Badge>
                    )}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
