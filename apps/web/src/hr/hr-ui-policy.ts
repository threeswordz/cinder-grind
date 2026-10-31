/** HR1-A presentation guards. Only backend-issued target Company choices are valid.
 * This does not create a grant, switch the fixed login role or authorize an API.
 */
export type HrCompanyChoice = {
  id: string;
  categories: readonly string[];
  permissions: readonly string[];
};

export function employmentCompanies<T extends HrCompanyChoice>(companies: readonly T[]): T[] {
  return companies.filter(company => company.categories.includes('employment') &&
    company.permissions.includes('hr.employment.view'));
}

export function selectedHrCompany(requestedId: string, companies: readonly HrCompanyChoice[]): string {
  if (requestedId) return companies.some(company => company.id === requestedId) ? requestedId : '';
  return companies[0]?.id ?? '';
}

export function selectedHrEmployee(
  requestedId: string, currentPage: readonly { id: string }[],
): string {
  return requestedId && currentPage.some(employee => employee.id === requestedId) ? requestedId : '';
}
