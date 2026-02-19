'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function parseBoolean(formData: FormData, key: string, defaultValue = false): boolean {
  const value = formData.get(key);
  if (value === null) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    return value === 'true' || value === 'on' || value === '1';
  }
  return defaultValue;
}

function parseIntField(formData: FormData, key: string, defaultValue = 0): number {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${key}`);
  }
  return parsed;
}

function parseFloatField(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${key}`);
  }
  return parsed;
}

function sanitizeGeoJson(raw: string, allowEmpty = false): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Polygon must be a valid GeoJSON string');
  }

  const polygon = parsed as { type?: string; coordinates?: number[][][] };
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    polygon.type !== 'Polygon' ||
    !Array.isArray(polygon.coordinates) ||
    !Array.isArray(polygon.coordinates[0])
  ) {
    if (allowEmpty) {
      return JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] });
    }
    throw new Error('Polygon GeoJSON must be a Polygon with coordinates');
  }

  const ring = polygon.coordinates[0];
  if (ring.length < 4) {
    throw new Error('Polygon requires at least three points');
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  return JSON.stringify({
    type: 'Polygon',
    coordinates: [ring],
  });
}

function sanitizeMetadata(raw: string | null): string {
  if (!raw) {
    return '{}';
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Metadata must be an object');
    }
    return JSON.stringify(parsed);
  } catch {
    throw new Error('Metadata must be valid JSON');
  }
}

export async function createZone(_: string | null, formData: FormData) {
  await requireAdminSession();

  const code = requireString(formData, 'code').toUpperCase();
  const name = requireString(formData, 'name');
  const description = optionalString(formData, 'description');
  const priority = parseIntField(formData, 'priority', 0);
  const isActive = parseBoolean(formData, 'is_active', true);
  const polygonGeoJson = sanitizeGeoJson(requireString(formData, 'polygonGeoJson'));
  const metadata = sanitizeMetadata(optionalString(formData, 'metadata'));

  const polygonJsonSql = Prisma.sql`${polygonGeoJson}::jsonb`;
  const metadataSql = Prisma.sql`${metadata}::jsonb`;

  const result = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO zones (code, name, description, is_active, priority, polygon, polygon_json, metadata)
    VALUES (
      ${code},
      ${name},
      ${description},
      ${isActive},
      ${priority},
      ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJson}), 4326),
      ${polygonJsonSql},
      ${metadataSql}
    )
    RETURNING id
  `;

  const createdId = result[0]?.id;

  revalidatePath('/admin/zones');
  redirect(createdId ? `/admin/zones/${createdId}` : '/admin/zones');
}

export async function updateZone(_: string | null, formData: FormData) {
  await requireAdminSession();

  const id = requireString(formData, 'id');
  const code = requireString(formData, 'code').toUpperCase();
  const name = requireString(formData, 'name');
  const description = optionalString(formData, 'description');
  const priority = parseIntField(formData, 'priority', 0);
  const isActive = parseBoolean(formData, 'is_active', true);
  const polygonGeoJson = sanitizeGeoJson(requireString(formData, 'polygonGeoJson'));
  const metadata = sanitizeMetadata(optionalString(formData, 'metadata'));

  const polygonJsonSql = Prisma.sql`${polygonGeoJson}::jsonb`;
  const metadataSql = Prisma.sql`${metadata}::jsonb`;

  await prisma.$executeRaw`
    UPDATE zones
    SET
      code = ${code},
      name = ${name},
      description = ${description},
      is_active = ${isActive},
      priority = ${priority},
      polygon = ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJson}), 4326),
      polygon_json = ${polygonJsonSql},
      metadata = ${metadataSql},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  revalidatePath('/admin/zones');
  redirect(`/admin/zones/${id}`);
}

export async function deleteZone(_: string | null, formData: FormData) {
  await requireAdminSession();
  const id = requireString(formData, 'id');

  await prisma.$executeRaw`DELETE FROM zones WHERE id = ${id}`;

  revalidatePath('/admin/zones');
  redirect('/admin/zones');
}

export async function upsertZonePrice(_: string | null, formData: FormData) {
  await requireAdminSession();

  const zoneId = requireString(formData, 'zone_id');
  const serviceId = requireString(formData, 'service_id');
  const priceInput = requireString(formData, 'price');
  const validFromInput = optionalString(formData, 'valid_from');
  const validToInput = optionalString(formData, 'valid_to');
  const discount = parseFloatField(formData, 'discount');
  const isActive = parseBoolean(formData, 'price_active', true);

  const priceFloat = Number.parseFloat(priceInput);
  if (!Number.isFinite(priceFloat)) {
    throw new Error('Price must be a valid number');
  }
  const priceCents = Math.round(priceFloat * 100);

  const validFromSql = validFromInput ? Prisma.sql`${validFromInput}::timestamptz` : Prisma.sql`NOW()`;
  const validToSql = validToInput ? Prisma.sql`${validToInput}::timestamptz` : Prisma.sql`NULL`;
  const discountValue = discount ?? 0;

  await prisma.$executeRaw`
    INSERT INTO zone_service_prices (
      zone_id,
      service_id,
      price,
      valid_from,
      valid_to,
      is_active,
      discount_percentage
    )
    VALUES (
      ${zoneId},
      ${serviceId},
      ${priceCents},
      ${validFromSql},
      ${validToSql},
      ${isActive},
      ${discountValue}
    )
    ON CONFLICT (zone_id, service_id, valid_from)
    DO UPDATE SET
      price = EXCLUDED.price,
      valid_to = EXCLUDED.valid_to,
      is_active = EXCLUDED.is_active,
      discount_percentage = EXCLUDED.discount_percentage,
      updated_at = NOW()
  `;

  revalidatePath(`/admin/zones/${zoneId}`);
  redirect(`/admin/zones/${zoneId}`);
}

export async function deactivateZonePrice(_: string | null, formData: FormData) {
  await requireAdminSession();
  const priceId = requireString(formData, 'price_id');
  const zoneId = requireString(formData, 'zone_id');

  await prisma.$executeRaw`
    UPDATE zone_service_prices
    SET is_active = false, updated_at = NOW()
    WHERE id = ${priceId}
  `;

  revalidatePath(`/admin/zones/${zoneId}`);
  redirect(`/admin/zones/${zoneId}`);
}
