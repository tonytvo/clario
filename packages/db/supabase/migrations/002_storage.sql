-- ============================================================
-- Clario receipt storage bucket
-- Run after 001_initial_schema.sql
-- ============================================================

-- Create the receipts bucket (private — RLS controls all access)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,   -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- ── Storage RLS policies ──────────────────────────────────────

-- Authenticated users can upload to their own sub-folder (userId/expenseId/...)
create policy "receipts: owner can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Only authenticated group members can read receipts for expenses in their groups.
-- Path format: {userId}/{expenseId}/{timestamp}_{filename}
-- We extract the expenseId (segment 2) and verify the requester is a group member.
create policy "receipts: group members can read"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and auth.uid() is not null
    and (string_to_array(name, '/'))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.expenses e
      where e.id::text = (string_to_array(name, '/'))[2]
        and public.is_group_member(e.group_id)
    )
  );

-- Uploader can delete their own files
create policy "receipts: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
