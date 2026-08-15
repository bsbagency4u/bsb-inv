import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Tags,
  Warehouse,
  ShoppingCart,
  Receipt,
  Undo2,
  ShoppingBag,
  FileText,
  RotateCcw,
  Users,
  Truck,
  BarChart3,
  Settings,
  Store,
  Box,
  ScanBarcode,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Phase when the module becomes functional. Modules not yet implemented render as "Coming soon". */
  phase?: number;
  badge?: "coming-soon";
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, phase: 1 }],
  },
  {
    label: "Inventory",
    items: [
      { title: "Products", href: "/inventory/products", icon: Package, phase: 2 },
      { title: "Categories", href: "/inventory/categories", icon: Tags, phase: 2 },
      { title: "Stock", href: "/inventory/stock", icon: Warehouse, phase: 2 },
      {
        title: "Stores & Warehouses",
        href: "/inventory/warehouses",
        icon: Box,
        phase: 3,
      },
      { title: "Transfers", href: "/inventory/transfers", icon: Boxes, phase: 3 },
      { title: "Barcode", href: "/inventory/barcode", icon: ScanBarcode, phase: 4 },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "POS", href: "/sales/pos", icon: ShoppingCart, phase: 2 },
      { title: "Invoices", href: "/sales/invoices", icon: FileText, phase: 2 },
      { title: "Returns", href: "/sales/returns", icon: Undo2, phase: 3 },
    ],
  },
  {
    label: "Purchase",
    items: [
      { title: "Orders", href: "/purchase/orders", icon: ShoppingBag, phase: 2 },
      { title: "Invoices", href: "/purchase/invoices", icon: Receipt, phase: 2 },
      { title: "Returns", href: "/purchase/returns", icon: RotateCcw, phase: 3 },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Customers", href: "/customers", icon: Users, phase: 2 },
      { title: "Suppliers", href: "/suppliers", icon: Truck, phase: 2 },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Reports", href: "/reports", icon: BarChart3, phase: 2 }],
  },
  {
    label: "Account",
    items: [{ title: "Settings", href: "/settings", icon: Settings, phase: 1 }],
  },
];

export const SETTINGS_NAVIGATION: NavItem[] = [
  { title: "Business", href: "/settings/business", icon: Store },
  { title: "Users & Roles", href: "/settings/users", icon: Users },
  { title: "Tax", href: "/settings/tax", icon: Receipt },
  { title: "Invoice", href: "/settings/invoice", icon: FileText },
  { title: "Inventory", href: "/settings/inventory", icon: Boxes },
  { title: "Sales", href: "/settings/sales", icon: ShoppingCart },
  { title: "Purchase", href: "/settings/purchase", icon: ShoppingBag },
  { title: "Payments", href: "/settings/payments", icon: Wallet },
  { title: "Counters", href: "/settings/counters", icon: Monitor },
  { title: "Warehouses", href: "/settings/warehouses", icon: Warehouse },
  { title: "Notifications", href: "/settings/notifications", icon: Bell },
  { title: "Backup", href: "/settings/backup", icon: Archive },
  { title: "Audit Log", href: "/settings/system/audit", icon: History },
  { title: "System", href: "/settings/system", icon: Settings },
];

import {
  Bell,
  Wallet,
  Monitor,
  Archive,
  History,
} from "lucide-react";
