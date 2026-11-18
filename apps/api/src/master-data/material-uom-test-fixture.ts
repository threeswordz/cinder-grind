import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { MaterialUomService } from './material-uom.service';

// Disposable fixture only. No retained Company configuration or inventory effects.
export async function materialUomFixture(db: PrismaService) {
  const suffix = randomUUID().slice(0, 8), password = randomBytes(32).toString('hex');
  const passwordHash = await new PasswordService().hash(password), sessions = new SessionService(db);
  const company = await db.company.create({ data: { companyCode: 'UOM-' + suffix, companyName: 'Synthetic UOM definitions' } });
  const other = await db.company.create({ data: { companyCode: 'UOM-X-' + suffix, companyName: 'Other synthetic Company' } });
  const codes = ['master.material.view', 'master.material.manage', 'master.material.conversion.manage'];
  async function actor(name: string, permissions: string[], companyId = company.id, employee = true) {
    const e = employee ? await db.employee.create({ data: { companyId, employeeCode: name, employeeName: 'Synthetic ' + name } }) : null;
    const user = await db.user.create({ data: { companyId, ...(e ? { employeeId: e.id } : {}), email: name.toLowerCase() + '-' + suffix + '@example.invalid', displayName: name, passwordHash } });
    const role = await db.role.create({ data: { companyId, roleCode: name, roleName: name } });
    const definitions = await db.permission.findMany({ where: { permissionCode: { in: permissions } } });
    if (definitions.length !== permissions.length) throw Error('Missing material-UOM capability');
    await db.rolePermission.createMany({ data: definitions.map(p => ({ roleId: role.id, permissionId: p.id })) });
    await db.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
    const session = await sessions.create(user.id), auth = await sessions.resolve(session.sessionToken);
    if (!auth) throw Error('Synthetic UOM session missing');
    return { employee: e, user, role, session, auth, password };
  }
  const maker = await actor('MAINTAINER', codes), viewer = await actor('READER', [codes[0]!]);
  const noConversion = await actor('LEGACY_MAINTAINER', codes.slice(0, 2));
  const technical = await actor('SYS_ADMIN', codes), detached = await actor('DETACHED', codes, company.id, false);
  const foreign = await actor('FOREIGN', codes, other.id);
  const unit = (id: string, code: string, precision: number) => db.unitOfMeasure.create({ data: { companyId: id, uomCode: code, uomName: code, decimalPlaces: precision } });
  const each = await unit(company.id, 'EA', 0), carton = await unit(company.id, 'CARTON', 0), third = await unit(company.id, 'THIRD', 0), fine = await unit(company.id, 'FINE', 6), foreignUnit = await unit(other.id, 'FOREIGN', 0);
  const material = await db.material.create({ data: { companyId: company.id, materialCode: 'MAT', materialName: 'Synthetic conversion material', defaultUomId: each.id } });
  const second = await db.material.create({ data: { companyId: company.id, materialCode: 'SECOND', materialName: 'Separate material', defaultUomId: each.id } });
  const foreignMaterial = await db.material.create({ data: { companyId: other.id, materialCode: 'OTHER', materialName: 'Other material', defaultUomId: foreignUnit.id } });
  const service = new MaterialUomService(db, new AuditService(db));
  return { company, other, maker, viewer, noConversion, technical, detached, foreign, each, carton, third, fine, foreignUnit, material, second, foreignMaterial, sessions, service };
}
