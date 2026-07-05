INSERT INTO public.shops (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Wakuja Shop')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seed_shop uuid := '11111111-1111-1111-1111-111111111111';
  new_role public.user_role := 'cashier';
BEGIN
  IF lower(NEW.email) = 'kulwakulangwa@gmail.com' THEN
    new_role := 'owner';
  END IF;

  INSERT INTO public.staff (id, shop_id, full_name, email, role, can_discount, can_manage_till, is_active)
  VALUES (
    NEW.id,
    seed_shop,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    new_role,
    new_role = 'owner',
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    shop_id = EXCLUDED.shop_id,
    full_name = COALESCE(NULLIF(public.staff.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    role = CASE WHEN lower(EXCLUDED.email) = 'kulwakulangwa@gmail.com' THEN 'owner'::public.user_role ELSE public.staff.role END,
    can_discount = CASE WHEN lower(EXCLUDED.email) = 'kulwakulangwa@gmail.com' THEN true ELSE public.staff.can_discount END,
    can_manage_till = true,
    is_active = true;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.staff (id, shop_id, full_name, email, role, can_discount, can_manage_till, is_active)
SELECT
  u.id,
  '11111111-1111-1111-1111-111111111111'::uuid,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Owner'),
  u.email,
  'owner'::public.user_role,
  true,
  true,
  true
FROM auth.users u
WHERE lower(u.email) = 'kulwakulangwa@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  shop_id = EXCLUDED.shop_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = 'owner'::public.user_role,
  can_discount = true,
  can_manage_till = true,
  is_active = true;