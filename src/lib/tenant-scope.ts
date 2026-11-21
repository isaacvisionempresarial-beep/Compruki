export type TenantIdRow = {
  id: string;
  tenant_id: string | null;
};

/** Ids that already belong to another store. A missing tenant counts as foreign. */
export function foreignIds(rows: TenantIdRow[], tenantId: string) {
  return rows.filter((row) => row.tenant_id !== tenantId).map((row) => row.id);
}
