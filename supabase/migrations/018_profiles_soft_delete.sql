-- ============================================================
-- INFRA MEDIK POS — Migration 018: Profile soft delete
-- Run after 017
-- ============================================================

-- Soft-delete timestamp (null = active profile row)
alter table profiles
  add column deleted_at timestamptz;

create index idx_profiles_not_deleted
  on profiles(id)
  where deleted_at is null;

-- Audit action for account removal
alter type audit_action add value if not exists 'delete_user';

-- ─── RPC: soft-delete profile + audit (called from delete-user Edge Function)
create or replace function admin_soft_delete_user(
  p_user_id uuid,
  p_email   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
begin
  if not is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  select * into v_profile
  from profiles
  where id = p_user_id
    and deleted_at is null;

  if not found then
    raise exception 'User not found or already removed';
  end if;

  if lower(trim(v_profile.email)) <> lower(trim(p_email)) then
    raise exception 'Email does not match this account';
  end if;

  update profiles
  set deleted_at = now(),
      is_active  = false,
      updated_at = now()
  where id = p_user_id;

  insert into audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  values (
    auth.uid(),
    'delete_user',
    'profiles',
    p_user_id,
    jsonb_build_object(
      'email',     v_profile.email,
      'full_name', v_profile.full_name,
      'role',      v_profile.role,
      'is_active', v_profile.is_active
    ),
    jsonb_build_object('deleted_at', now(), 'is_active', false)
  );
end;
$$;
