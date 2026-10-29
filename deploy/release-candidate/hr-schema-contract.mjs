import {createHash} from 'node:crypto';
// DEC-039: exact first employee/access schema; never a general HR exemption.
const models = {
  "HrCompanyAccess": "b6797608eb6fde8ff439b5000c66d80f88c3fe5375efd7b15de200a6af8f6fe0",
  "HrEmployment": "ff9fce961b7bccdaf01f75dc1054f956f105cd45e788feb96b9692db3c3eeb62",
  "HrEmploymentRevision": "4241df404569ea1699a2b67d54c7c9375aa8a57aff50c43067d15a9aa5d63227",
  "HrPrivateRevision": "10b6eb7339a2a92205869211b9e802712cbfe7e20d169c38b6cdf7e48f0b8490",
  "HrPerson": "0bb158b44d65a8bd033358959465d676042a8b2cc3b3ed7611bb0be3387d1043",
  "HrPersonLink": "839602029ac94680b2f050ad59c7baf6443295bd1abdb01b2c5a89867455a314",
  "HrReplay": "79a6ba4356876423649b199b261eb6c26c8f7c6364ecd099ef16afe09e827f36"
};
const relations = {
  "Company": [
    "hrCompanyAccess HrCompanyAccess[]",
    "hrEmployments HrEmployment[]",
    "hrEmploymentRevisions HrEmploymentRevision[]",
    "hrPrivateRevisions HrPrivateRevision[]",
    "hrPersonLinks HrPersonLink[]",
    "hrReplays HrReplay[]"
  ],
  "Employee": [
    "hrEmployment HrEmployment?",
    "hrPrivateRevisions HrPrivateRevision[]",
    "hrPersonLink HrPersonLink?",
    "@@unique([companyId, id])"
  ],
  "User": [
    "hrAccessSubjects HrCompanyAccess[] @relation(\"HrAccessSubject\")",
    "hrAccessChanges HrCompanyAccess[] @relation(\"HrAccessActor\")",
    "hrEmploymentRevisions HrEmploymentRevision[] @relation(\"HrEmploymentActor\")",
    "hrPrivateRevisions HrPrivateRevision[] @relation(\"HrPrivateActor\")",
    "hrPeople HrPerson[] @relation(\"HrPersonActor\")",
    "hrPersonLinks HrPersonLink[] @relation(\"HrPersonLinkActor\")",
    "hrReplays HrReplay[] @relation(\"HrReplayActor\")"
  ],
  "Project": [
    "hrEmploymentRevisions HrEmploymentRevision[]"
  ]
};
export const hrTables = ['hr_company_access','hr_employments','hr_employment_revisions','hr_private_revisions','hr_people','hr_person_links','hr_replays'];
export function stripHrSchema(schema) {
  const found = new Set(), removed = new Set();
  const text = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (Object.hasOwn(models, name)) {
      if (found.has(name) || createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex') !== models[name]) throw new Error('HR schema differs from the exact DEC-039 persistence contract.');
      found.add(name); return '';
    }
    return block.split('\n').filter(line => {
      const normalized = line.trim().replace(/\s+/g,' ');
      if (!(relations[name] ?? []).includes(normalized)) return true;
      const key = name + ':' + normalized;
      if (removed.has(key)) throw new Error('Duplicate HR relation or scoped key.');
      removed.add(key); return false;
    }).join('\n');
  }).replace('// DEC-039: protected HR records; no private scalar added to canonical Employee.', '');
  if ((found.size && found.size !== 7) || (removed.size && removed.size !== 18) || Boolean(found.size) !== Boolean(removed.size)) throw new Error('Partial HR persistence contract.');
  return {text, present:found.size === 7};
}
