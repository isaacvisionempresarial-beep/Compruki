-- COMPRUKI · identidad pública de la tienda (Etapa 1 · gestión de tienda)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql. No conecta Dropi ni WhatsApp Business.

alter table public.tenants
  add column if not exists public_tagline text not null default '';

alter table public.tenants
  add column if not exists public_whatsapp text not null default '';

comment on column public.tenants.public_tagline is
  'Frase corta visible en la tienda pública. Vacío = texto por defecto.';

comment on column public.tenants.public_whatsapp is
  'Celular Colombia 10 dígitos (empieza en 3) para Abrir WhatsApp a mano. Vacío = sin enlace.';
