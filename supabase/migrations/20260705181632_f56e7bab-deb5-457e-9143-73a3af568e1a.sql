
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_shop_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.pos_products() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.report_sales_summary(date, date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cashier_today_summary() FROM public, anon;

CREATE POLICY "authenticated read shop-media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-media');
CREATE POLICY "owner write shop-media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-media' AND public.is_owner());
CREATE POLICY "owner update shop-media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-media' AND public.is_owner());
CREATE POLICY "owner delete shop-media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-media' AND public.is_owner());
