-- ============================================================
-- Clario receipt storage bucket
-- Run after 001_initial_schema.sql
-- ============================================================

-- Create the receipts bucket (public = files are readable without auth token)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
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

-- Anyone can read (receipts are shared among group members; public bucket)
create policy "receipts: public read"
  on storage.objects for select
  using (bucket_id = 'receipts');

-- Uploader can delete their own files
create policy "receipts: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
