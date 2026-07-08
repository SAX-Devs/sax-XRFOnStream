-- Realtime for quantified concentrations: low frequency (~one analysis every
-- few minutes), so broadcasting is essentially free and the concentration
-- trend chart updates live as each new analysis lands.
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_concentrations;
