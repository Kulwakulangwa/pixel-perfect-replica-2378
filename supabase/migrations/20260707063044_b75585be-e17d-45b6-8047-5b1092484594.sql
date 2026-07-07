
-- 1) Fix shop-media storage policies to be shop-scoped by path prefix "<shop_id>/..."
DROP POLICY IF EXISTS "authenticated read shop-media" ON storage.objects;
DROP POLICY IF EXISTS "owner write shop-media" ON storage.objects;
DROP POLICY IF EXISTS "owner update shop-media" ON storage.objects;
DROP POLICY IF EXISTS "owner delete shop-media" ON storage.objects;

CREATE POLICY "shop scoped read shop-media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'shop-media'
  AND public.is_staff()
  AND (storage.foldername(name))[1] = public.current_shop_id()::text
);

CREATE POLICY "owner write shop-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-media'
  AND public.is_owner()
  AND (storage.foldername(name))[1] = public.current_shop_id()::text
);

CREATE POLICY "owner update shop-media" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'shop-media'
  AND public.is_owner()
  AND (storage.foldername(name))[1] = public.current_shop_id()::text
)
WITH CHECK (
  bucket_id = 'shop-media'
  AND public.is_owner()
  AND (storage.foldername(name))[1] = public.current_shop_id()::text
);

CREATE POLICY "owner delete shop-media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-media'
  AND public.is_owner()
  AND (storage.foldername(name))[1] = public.current_shop_id()::text
);

-- 2) Revoke EXECUTE from PUBLIC / anon on all SECURITY DEFINER functions in public.
-- Trigger-only functions: revoke from authenticated too (only fired via triggers).
REVOKE ALL ON FUNCTION public.snapshot_unit_cost() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_stock_on_sale_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helper/RLS/RPC functions: revoke from PUBLIC & anon, keep for authenticated (needed by RLS/RPC).
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_shop_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pos_products() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cashier_today_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_sales_summary(date, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_shop_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_products() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cashier_today_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_summary(date, date) TO authenticated;
