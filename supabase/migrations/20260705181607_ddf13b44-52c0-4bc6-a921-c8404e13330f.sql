
CREATE TYPE public.user_role AS ENUM ('owner', 'cashier');
CREATE TYPE public.stock_movement_type AS ENUM ('restock', 'adjustment', 'sale_deduction', 'void_restore');
CREATE TYPE public.payment_method AS ENUM ('cash', 'lipa_namba');
CREATE TYPE public.lipa_namba_provider AS ENUM ('mpesa', 'airtel_money', 'tigo_pesa');
CREATE TYPE public.sale_type AS ENUM ('cash', 'credit');
CREATE TYPE public.sale_status AS ENUM ('completed', 'voided');
CREATE TYPE public.expense_category AS ENUM ('rent', 'electricity', 'transport', 'salaries', 'stock_purchase', 'other');
CREATE TYPE public.till_status AS ENUM ('open', 'closed');

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  receipt_footer text DEFAULT 'Asante kwa kununua Wakuja Shop. Karibu tena!',
  currency text NOT NULL DEFAULT 'TSh',
  low_stock_default int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'New User',
  email text,
  phone text,
  role public.user_role NOT NULL DEFAULT 'cashier',
  can_discount boolean NOT NULL DEFAULT false,
  can_manage_till boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.user_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = _user_id AND role = _role AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT shop_id FROM public.staff WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid() AND role = 'owner' AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid() AND is_active);
$$;

INSERT INTO public.shops (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Wakuja Shop');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seed_shop uuid := '11111111-1111-1111-1111-111111111111';
  new_role public.user_role := 'cashier';
BEGIN
  IF lower(NEW.email) = 'kulwakulangwa@gmail.com' THEN
    new_role := 'owner';
  END IF;
  INSERT INTO public.staff (id, shop_id, full_name, email, role, can_discount, can_manage_till)
  VALUES (
    NEW.id, seed_shop,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email, new_role, new_role = 'owner', true
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "staff self read" ON public.staff FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());
CREATE POLICY "owner manages staff" ON public.staff FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id());
CREATE POLICY "shops read own" ON public.shops FOR SELECT TO authenticated
  USING (id = public.current_shop_id());
CREATE POLICY "owner updates shop" ON public.shops FOR UPDATE TO authenticated
  USING (public.is_owner() AND id = public.current_shop_id());

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  buying_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL,
  current_stock int NOT NULL DEFAULT 0,
  minimum_stock int NOT NULL DEFAULT 5,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_shop_active_idx ON public.products (shop_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all products" ON public.products FOR ALL TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id())
  WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id());

CREATE OR REPLACE FUNCTION public.pos_products()
RETURNS TABLE (id uuid, name text, sku text, selling_price numeric, current_stock int, minimum_stock int, image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.sku, p.selling_price, p.current_stock, p.minimum_stock, p.image_url
  FROM public.products p
  WHERE p.shop_id = public.current_shop_id() AND p.is_active AND public.is_staff();
$$;
GRANT EXECUTE ON FUNCTION public.pos_products() TO authenticated;

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity_change int NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_idx ON public.stock_movements (product_id, created_at DESC);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());
CREATE POLICY "owner inserts movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id());

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET current_stock = current_stock + NEW.quantity_change, updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_shop_idx ON public.customers (shop_id);
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_staff() AND shop_id = public.current_shop_id());
CREATE POLICY "staff insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND shop_id = public.current_shop_id());
CREATE POLICY "owner updates customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  cashier_id uuid NOT NULL REFERENCES auth.users(id),
  customer_id uuid REFERENCES public.customers(id),
  subtotal numeric(12,2) NOT NULL,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  payment_method public.payment_method,
  lipa_namba_provider public.lipa_namba_provider,
  sale_type public.sale_type NOT NULL,
  status public.sale_status NOT NULL DEFAULT 'completed',
  till_session_id uuid,
  client_ref text,
  synced boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, receipt_number),
  UNIQUE (shop_id, client_ref)
);
CREATE INDEX sales_shop_created_idx ON public.sales (shop_id, created_at DESC);
CREATE INDEX sales_cashier_created_idx ON public.sales (cashier_id, created_at DESC);
CREATE INDEX sales_customer_idx ON public.sales (customer_id) WHERE customer_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads sales" ON public.sales FOR SELECT TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());
CREATE POLICY "cashier reads own sales" ON public.sales FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() AND shop_id = public.current_shop_id());
CREATE POLICY "staff inserts sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND shop_id = public.current_shop_id() AND cashier_id = auth.uid());
CREATE POLICY "owner voids sales" ON public.sales FOR UPDATE TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL,
  line_total numeric(12,2) NOT NULL
);
CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items (product_id);
GRANT SELECT, INSERT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads sale_items" ON public.sale_items FOR SELECT TO authenticated
  USING (public.is_owner() AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.shop_id = public.current_shop_id()));
CREATE POLICY "cashier reads own sale_items" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.cashier_id = auth.uid()));
CREATE POLICY "staff inserts sale_items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.cashier_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop_id uuid; v_cashier uuid;
BEGIN
  SELECT shop_id, cashier_id INTO v_shop_id, v_cashier FROM public.sales WHERE id = NEW.sale_id;
  INSERT INTO public.stock_movements (shop_id, product_id, type, quantity_change, note, created_by)
  VALUES (v_shop_id, NEW.product_id, 'sale_deduction', -NEW.quantity, 'Auto: sale item', v_cashier);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_deduct_stock_on_sale_item
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale_item();

CREATE OR REPLACE FUNCTION public.snapshot_unit_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unit_cost IS NULL OR NEW.unit_cost = 0 THEN
    SELECT buying_price INTO NEW.unit_cost FROM public.products WHERE id = NEW.product_id;
    NEW.unit_cost := COALESCE(NEW.unit_cost, 0);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_snapshot_unit_cost
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_unit_cost();

CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL,
  lipa_namba_provider public.lipa_namba_provider,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_payments_customer_idx ON public.customer_payments (customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads payments" ON public.customer_payments FOR SELECT TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());
CREATE POLICY "owner inserts payments" ON public.customer_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id() AND recorded_by = auth.uid());

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id())
  WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id());

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  expense_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_shop_date_idx ON public.expenses (shop_id, expense_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id())
  WITH CHECK (public.is_owner() AND shop_id = public.current_shop_id());

CREATE TABLE public.till_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL REFERENCES auth.users(id),
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  closing_count numeric(12,2),
  expected_cash numeric(12,2),
  variance numeric(12,2),
  note text,
  status public.till_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX till_sessions_cashier_status_idx ON public.till_sessions (cashier_id, status);
GRANT SELECT, INSERT, UPDATE ON public.till_sessions TO authenticated;
GRANT ALL ON public.till_sessions TO service_role;
ALTER TABLE public.till_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads all till" ON public.till_sessions FOR SELECT TO authenticated
  USING (public.is_owner() AND shop_id = public.current_shop_id());
CREATE POLICY "cashier reads own till" ON public.till_sessions FOR SELECT TO authenticated
  USING (cashier_id = auth.uid());
CREATE POLICY "staff opens till" ON public.till_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND shop_id = public.current_shop_id() AND cashier_id = auth.uid());
CREATE POLICY "staff closes own till" ON public.till_sessions FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid());

CREATE OR REPLACE VIEW public.v_customer_balances
WITH (security_invoker = true) AS
SELECT c.id AS customer_id, c.shop_id, c.name, c.phone,
  COALESCE((SELECT SUM(total) FROM public.sales s WHERE s.customer_id = c.id AND s.sale_type='credit' AND s.status='completed'), 0)
    - COALESCE((SELECT SUM(amount) FROM public.customer_payments cp WHERE cp.customer_id = c.id), 0) AS balance,
  (SELECT MAX(created_at) FROM public.sales s WHERE s.customer_id = c.id) AS last_purchase_at
FROM public.customers c;
GRANT SELECT ON public.v_customer_balances TO authenticated;

CREATE OR REPLACE VIEW public.v_low_stock
WITH (security_invoker = true) AS
SELECT p.id, p.shop_id, p.name, p.current_stock, p.minimum_stock, p.image_url
FROM public.products p
WHERE p.is_active AND p.current_stock <= p.minimum_stock;
GRANT SELECT ON public.v_low_stock TO authenticated;

CREATE OR REPLACE VIEW public.v_best_sellers
WITH (security_invoker = true) AS
SELECT s.shop_id, si.product_id, si.product_name,
  SUM(si.quantity)::int AS units_sold, SUM(si.line_total) AS revenue
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE s.status = 'completed'
GROUP BY s.shop_id, si.product_id, si.product_name;
GRANT SELECT ON public.v_best_sellers TO authenticated;

CREATE OR REPLACE FUNCTION public.report_sales_summary(_from date, _to date)
RETURNS TABLE (day date, sales_count bigint, revenue numeric, cost numeric, profit numeric, discount_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (s.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day,
    COUNT(DISTINCT s.id) AS sales_count,
    COALESCE(SUM(si.line_total), 0) AS revenue,
    COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cost,
    COALESCE(SUM(si.line_total) - SUM(si.unit_cost * si.quantity), 0) AS profit,
    COALESCE(SUM(DISTINCT s.discount), 0) AS discount_total
  FROM public.sales s
  LEFT JOIN public.sale_items si ON si.sale_id = s.id
  WHERE s.status = 'completed' AND s.shop_id = public.current_shop_id() AND public.is_owner()
    AND (s.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date BETWEEN _from AND _to
  GROUP BY 1 ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.report_sales_summary(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.cashier_today_summary()
RETURNS TABLE (sales_count bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::bigint, COALESCE(SUM(total), 0)
  FROM public.sales WHERE cashier_id = auth.uid() AND status = 'completed'
    AND (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date = (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
$$;
GRANT EXECUTE ON FUNCTION public.cashier_today_summary() TO authenticated;
