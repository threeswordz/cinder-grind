import { UnprocessableEntityException } from '@nestjs/common';

export type LoginInput = {
  email: string;
  password: string;
};

type ValidationError = {
  field: string;
  message: string;
};

export function parseLoginInput(body: unknown): LoginInput {
  const errors: ValidationError[] = [];

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validationException([
      { field: 'body', message: 'Request body must be a JSON object.' },
    ]);
  }

  const record = body as Record<string, unknown>;
  const email = record.email;
  const password = record.password;

  if (
    typeof email !== 'string' ||
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+$/.test(email)
  ) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 1024
  ) {
    errors.push({
      field: 'password',
      message: 'Password must be between 1 and 1024 characters.',
    });
  }

  if (errors.length > 0) throw validationException(errors);

  return {
    email: email as string,
    password: password as string,
  };
}

function validationException(
  errors: ValidationError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors,
  });
}
