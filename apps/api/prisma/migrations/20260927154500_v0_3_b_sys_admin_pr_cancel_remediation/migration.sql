-- V0.3-B post-merge governance remediation.
-- DEC-005 / DEC-006: projects.access_all and the technical SYS_ADMIN role
-- must not implicitly grant Procurement business cancellation authority.
--
-- Keep procurement.pr.cancel in the permission catalogue. Remove only the
-- inherited SYS_ADMIN role mapping so cancellation must be granted explicitly
-- through a configured business role.

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."role_code" = 'SYS_ADMIN'
  AND p."permission_code" = 'procurement.pr.cancel';
