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
  ('audit.view', 'View audit logs', 'View audit logs.')
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
  'purchase.view',
  'purchase.manage',
  'customer.view',
  'customer.manage',
  'supplier.view',
  'supplier.manage',
  'report.view',
  'settings.view'
)
where r.slug = 'manager'
on conflict do nothing;
