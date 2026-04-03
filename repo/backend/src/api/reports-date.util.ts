import { BadRequestException } from "@nestjs/common";

const MMDDYYYY = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

export function parseDateRangeStrict(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) {
    return undefined;
  }

  const match = MMDDYYYY.exec(value);
  if (!match) {
    throw new BadRequestException("Date filters must use MM/DD/YYYY");
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  const valid =
    candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
  if (!valid) {
    throw new BadRequestException("Date filters must use MM/DD/YYYY");
  }

  return candidate;
}
