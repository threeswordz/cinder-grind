import assert from 'node:assert/strict';
import test from 'node:test';
import {
  employmentCompanies, selectedHrCompany, selectedHrEmployee,
} from '../hr/hr-ui-policy.ts';

test('HR employment selection accepts only backend-listed Company category and viewer capability', () => {
  const choices = [
    { id: 'company-a', categories: ['employment'], permissions: ['hr.employment.view'] },
    { id: 'company-b', categories: ['bank'], permissions: ['hr.bank.view'] },
    { id: 'company-c', categories: ['employment'], permissions: ['hr.employment.manage'] },
    { id: 'company-d', categories: ['identity'], permissions: ['hr.employment.view'] },
    { id: 'company-e', categories: ['employment','bank'], permissions: ['hr.employment.view','hr.bank.view'] },
  ];
  const permitted = employmentCompanies(choices);
  assert.deepEqual(permitted.map(company => company.id), ['company-a','company-e']);
  assert.equal(selectedHrCompany('company-e', permitted), 'company-e');
  assert.equal(selectedHrCompany('company-b', permitted), 'company-a');
  assert.equal(selectedHrCompany('forged-cross-company', permitted), 'company-a');
  assert.equal(selectedHrCompany('company-e', []), '');
});

test('HR employee selection cannot retain an employee from another Company or page', () => {
  const companyAPage = [{ id: 'employee-a' }, { id: 'employee-b' }];
  const companyBPage = [{ id: 'employee-c' }];
  assert.equal(selectedHrEmployee('employee-a', companyAPage), 'employee-a');
  assert.equal(selectedHrEmployee('employee-a', companyBPage), '');
  assert.equal(selectedHrEmployee('employee-b', []), '');
  assert.equal(selectedHrEmployee('employee-c', companyBPage), 'employee-c');
});
