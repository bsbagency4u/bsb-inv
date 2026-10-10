-- BSB StockFlow — Phase 1 seed data
-- Roles and permissions reference data (idempotent).

insert into public.roles (name, slug, description, is_system)
values
  ('Owner', 'owner', 'Full access to the business.', true),
  ('Manager', 'manager', 'Manages day-to-day operations.', true),
  ('Staff', 'staff', 'Limited operational access.', true),
  ('Accountant', 'accountant', 'Financial and reporting access.', true)
on conflict (slug) do nothing;

insert into public.permissions (slug, name, description)
values
  ('business.view', 'View business', 'View business profile and settings.'),
  ('business.update', 'Update business', 'Update business profile and settings.'),
  ('dashboard.view', 'View dashboard', 'View the dashboard.'),
  ('product.view', 'View products', 'View product catalogue.'),
  ('product.manage', 'Manage products', 'Create and update products.'),
  ('inventory.view', 'View inventory', 'View stock and inventory.'),
  ('inventory.manage', 'Manage inventory', 'Adjust stock and inventory.'),
  ('sales.view', 'View sales', 'View sales and invoices.'),
  ('sales.manage', 'Manage sales', 'Create and update sales.'),
  ('purchase.view', 'View purchases', 'View purchase documents.'),
  ('purchase.manage', 'Manage purchases', 'Create and update purchases.'),
  ('customer.view', 'View customers', 'View customer records.'),
  ('customer.manage', 'Manage customers', 'Create and update customers.'),
  ('supplier.view', 'View suppliers', 'View supplier records.'),
  ('supplier.manage', 'Manage suppliers', 'Create and update suppliers.'),
  ('report.view', 'View reports', 'View reports.'),
  ('settings.view', 'View settings', 'View settings.'),
  ('settings.manage', 'Manage settings', 'Modify settings.'),
  ('users.manage', 'Manage users', 'Invite and manage users and roles.'),
  ('audit.view', 'View audit logs', 'View audit logs.'),
  ('sales.create', 'Create sales', 'Create sales invoices and returns.'),
  ('sales.edit', 'Edit sales', 'Edit sales invoices.'),
  ('sales.delete', 'Delete sales', 'Delete sales invoices.'),
  ('sales.cancel', 'Cancel sales', 'Cancel posted sales invoices.'),
  ('sales.backdate', 'Backdate sales', 'Save sales documents with a past date.'),
  ('sales.override_lock', 'Override sales lock', 'Change sales documents in a locked period.'),
  ('purchase.create', 'Create purchases', 'Create purchase bills and returns.'),
  ('purchase.edit', 'Edit purchases', 'Edit purchase bills.'),
  ('purchase.delete', 'Delete purchases', 'Delete purchase bills.'),
  ('purchase.cancel', 'Cancel purchases', 'Cancel posted purchase bills.'),
  ('purchase.backdate', 'Backdate purchases', 'Save purchase documents with a past date.'),
  ('purchase.override_lock', 'Override purchase lock', 'Change purchase documents in a locked period.')
on conflict (slug) do nothing;

-- Owner role gets every permission.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug = 'owner'
on conflict do nothing;

-- Manager gets operational permissions.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug in (
  'business.view',
  'dashboard.view',
  'product.view',
  'product.manage',
  'inventory.view',
  'inventory.manage',
  'sales.view',
  'sales.manage',
  'sales.create',
  'sales.edit',
  'sales.delete',
  'sales.cancel',
  'sales.backdate',
  'sales.override_lock',
  'purchase.view',
  'purchase.manage',
  'purchase.create',
  'purchase.edit',
  'purchase.delete',
  'purchase.cancel',
  'purchase.backdate',
  'purchase.override_lock',
  'customer.view',
  'customer.manage',
  'supplier.view',
  'supplier.manage',
  'report.view',
  'settings.view'
)
where r.slug = 'manager'
on conflict do nothing;
