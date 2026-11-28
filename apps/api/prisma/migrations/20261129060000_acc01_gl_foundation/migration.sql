-- ACC01 additive candidate. No operational accounts, grants, postings, or mappings seeded.
CREATE TABLE gl_accounts (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 code varchar(50) NOT NULL CHECK(length(btrim(code))>0), name varchar(200) NOT NULL CHECK(length(btrim(name))>0),
 account_type varchar(20) NOT NULL CHECK(account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
 is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX gl_accounts_company_id_id_key ON gl_accounts(company_id,id);
CREATE UNIQUE INDEX gl_accounts_company_id_code_key ON gl_accounts(company_id,code);
CREATE TABLE gl_periods (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 start_date date NOT NULL, end_date date NOT NULL, closed_at timestamptz(6),
 CHECK(start_date<=end_date)
);
CREATE UNIQUE INDEX gl_periods_company_id_id_key ON gl_periods(company_id,id);
CREATE UNIQUE INDEX gl_periods_company_id_start_date_key ON gl_periods(company_id,start_date);
CREATE TABLE gl_rule_revisions (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 rule_code varchar(50) NOT NULL CHECK(length(btrim(rule_code))>0), version integer NOT NULL CHECK(version>0),
 source_type varchar(50) NOT NULL CHECK(length(btrim(source_type))>0),
 evidence_reference varchar(200) NOT NULL CHECK(length(btrim(evidence_reference))>0)
);
CREATE UNIQUE INDEX gl_rule_revisions_company_id_id_key ON gl_rule_revisions(company_id,id);
CREATE UNIQUE INDEX gl_rule_revisions_company_id_rule_code_version_key ON gl_rule_revisions(company_id,rule_code,version);

CREATE TABLE gl_journals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, period_id uuid NOT NULL, rule_revision_id uuid NOT NULL,
 source_event_key varchar(200) NOT NULL CHECK(length(btrim(source_event_key))>0),
 source_type varchar(50) NOT NULL CHECK(length(btrim(source_type))>0),
 posting_date date NOT NULL, currency_code varchar(3) NOT NULL DEFAULT 'THB' CHECK(currency_code='THB'),
 actor_user_id uuid NOT NULL, reverses_journal_id uuid, sealed_at timestamptz(6),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT gl_journals_period_fkey FOREIGN KEY(company_id,period_id) REFERENCES gl_periods(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT gl_journals_rule_fkey FOREIGN KEY(company_id,rule_revision_id) REFERENCES gl_rule_revisions(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT gl_journals_actor_fkey FOREIGN KEY(company_id,actor_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CHECK(reverses_journal_id IS NULL OR reverses_journal_id<>id)
);
CREATE UNIQUE INDEX gl_journals_company_id_id_key ON gl_journals(company_id,id);
CREATE UNIQUE INDEX gl_journals_company_id_source_event_key_key ON gl_journals(company_id,source_event_key);
CREATE UNIQUE INDEX gl_journals_company_id_reverses_journal_id_key ON gl_journals(company_id,reverses_journal_id);
ALTER TABLE gl_journals ADD CONSTRAINT gl_journals_reversal_fkey FOREIGN KEY(company_id,reverses_journal_id) REFERENCES gl_journals(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE TABLE gl_journal_lines (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, journal_id uuid NOT NULL,
 line_no integer NOT NULL CHECK(line_no BETWEEN 1 AND 1000),
 account_id uuid NOT NULL, project_id uuid, side varchar(6) NOT NULL CHECK(side IN ('DEBIT','CREDIT')),
 amount_satang bigint NOT NULL CHECK(amount_satang BETWEEN 1 AND 999999999999999999),
 CONSTRAINT gl_journal_lines_journal_fkey FOREIGN KEY(company_id,journal_id) REFERENCES gl_journals(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT gl_journal_lines_account_fkey FOREIGN KEY(company_id,account_id) REFERENCES gl_accounts(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT gl_journal_lines_project_fkey FOREIGN KEY(company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX gl_journal_lines_journal_id_line_no_key ON gl_journal_lines(journal_id,line_no);
CREATE INDEX gl_journal_lines_company_id_account_id_idx ON gl_journal_lines(company_id,account_id);

CREATE FUNCTION gl_immutable() RETURNS trigger LANGUAGE plpgsql AS $gl$
BEGIN
 RAISE EXCEPTION 'GL_IMMUTABLE' USING ERRCODE='23514';
END $gl$;
CREATE TRIGGER gl_rule_revision_immutable BEFORE UPDATE OR DELETE ON gl_rule_revisions FOR EACH ROW EXECUTE FUNCTION gl_immutable();
CREATE TRIGGER gl_line_immutable BEFORE UPDATE OR DELETE ON gl_journal_lines FOR EACH ROW EXECUTE FUNCTION gl_immutable();

CREATE FUNCTION gl_period_guard() RETURNS trigger LANGUAGE plpgsql AS $gl$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'GL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  -- Serialize competing periods by actual Company row. Exclusion without a new extension.
  PERFORM 1 FROM companies WHERE id=NEW.company_id FOR UPDATE;
  IF NEW.closed_at IS NOT NULL OR EXISTS(SELECT 1 FROM gl_periods WHERE company_id=NEW.company_id
    AND start_date<=NEW.end_date AND end_date>=NEW.start_date) THEN RAISE EXCEPTION 'GL_PERIOD_INVALID' USING ERRCODE='23514'; END IF;
 ELSE
  IF OLD.closed_at IS NOT NULL OR NEW.closed_at IS NULL
   OR (to_jsonb(NEW)-'closed_at') IS DISTINCT FROM (to_jsonb(OLD)-'closed_at') THEN
   RAISE EXCEPTION 'GL_PERIOD_IMMUTABLE' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $gl$;
CREATE TRIGGER gl_period_guard BEFORE INSERT OR UPDATE OR DELETE ON gl_periods FOR EACH ROW EXECUTE FUNCTION gl_period_guard();

CREATE FUNCTION gl_journal_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $gl$
BEGIN
 IF NEW.sealed_at IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM gl_periods WHERE id=NEW.period_id AND company_id=NEW.company_id
   AND closed_at IS NULL AND NEW.posting_date BETWEEN start_date AND end_date FOR UPDATE
 ) OR NOT EXISTS(SELECT 1 FROM gl_rule_revisions WHERE id=NEW.rule_revision_id AND company_id=NEW.company_id AND source_type=NEW.source_type)
 THEN RAISE EXCEPTION 'GL_JOURNAL_SCOPE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $gl$;
CREATE TRIGGER gl_journal_insert_guard BEFORE INSERT ON gl_journals FOR EACH ROW EXECUTE FUNCTION gl_journal_insert_guard();

CREATE FUNCTION gl_line_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $gl$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM gl_journals WHERE id=NEW.journal_id AND company_id=NEW.company_id AND sealed_at IS NULL FOR UPDATE)
 THEN RAISE EXCEPTION 'GL_JOURNAL_SEALED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $gl$;
CREATE TRIGGER gl_line_insert_guard BEFORE INSERT ON gl_journal_lines FOR EACH ROW EXECUTE FUNCTION gl_line_insert_guard();

CREATE FUNCTION gl_journal_seal_guard() RETURNS trigger LANGUAGE plpgsql AS $gl$
DECLARE d numeric; c numeric; n bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'GL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL
 OR (to_jsonb(NEW)-'sealed_at') IS DISTINCT FROM (to_jsonb(OLD)-'sealed_at')
 THEN RAISE EXCEPTION 'GL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM gl_periods WHERE id=NEW.period_id AND company_id=NEW.company_id AND closed_at IS NULL FOR UPDATE)
 THEN RAISE EXCEPTION 'GL_PERIOD_CLOSED' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(amount_satang) FILTER(WHERE side='DEBIT'),0),
 coalesce(sum(amount_satang) FILTER(WHERE side='CREDIT'),0),count(*) INTO d,c,n
 FROM gl_journal_lines WHERE journal_id=NEW.id;
 IF n<2 OR d<=0 OR d<>c OR d>999999999999999999 THEN RAISE EXCEPTION 'GL_UNBALANCED' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
 WHERE l.journal_id=NEW.id AND NOT a.is_active) THEN RAISE EXCEPTION 'GL_ACCOUNT_INACTIVE' USING ERRCODE='23514'; END IF;
 IF NEW.reverses_journal_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM gl_journals WHERE id=NEW.reverses_journal_id AND company_id=NEW.company_id AND sealed_at IS NOT NULL)
  OR EXISTS(
   (SELECT account_id,project_id,side,amount_satang FROM gl_journal_lines WHERE journal_id=NEW.id
    EXCEPT ALL SELECT account_id,project_id,CASE WHEN side='DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount_satang FROM gl_journal_lines WHERE journal_id=NEW.reverses_journal_id)
   UNION ALL
   (SELECT account_id,project_id,CASE WHEN side='DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount_satang FROM gl_journal_lines WHERE journal_id=NEW.reverses_journal_id
    EXCEPT ALL SELECT account_id,project_id,side,amount_satang FROM gl_journal_lines WHERE journal_id=NEW.id)
  ) THEN RAISE EXCEPTION 'GL_REVERSAL_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $gl$;
CREATE TRIGGER gl_journal_seal_guard BEFORE UPDATE OR DELETE ON gl_journals FOR EACH ROW EXECUTE FUNCTION gl_journal_seal_guard();

CREATE FUNCTION gl_require_sealed() RETURNS trigger LANGUAGE plpgsql AS $gl$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM gl_journals WHERE id=NEW.id AND sealed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'GL_JOURNAL_INCOMPLETE' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $gl$;
CREATE CONSTRAINT TRIGGER gl_require_sealed AFTER INSERT ON gl_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gl_require_sealed();
