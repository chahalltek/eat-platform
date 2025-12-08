import type {
  BullhornCandidate,
  BullhornJob,
  BullhornMappingConfig,
  BullhornPlacement,
  MappedCandidate,
  MappedJob,
  MappedPlacement,
} from './types';

export const defaultMappingConfig: BullhornMappingConfig = {
  job: {
    id: 'id',
    title: 'title',
    employmentType: 'employmentType',
    address: 'address',
    description: 'description',
    dateAdded: 'dateAdded',
    remoteHint: 'customText10',
    company: 'clientCorporation',
  },
  candidate: {
    id: 'id',
    firstName: 'firstName',
    lastName: 'lastName',
    email: 'email',
    phone: 'phone',
    city: 'city',
    state: 'state',
    country: 'country',
    dateAdded: 'dateAdded',
    occupation: 'occupation',
    source: 'source',
  },
  placement: {
    id: 'id',
    job: 'jobOrder',
    candidate: 'candidate',
    startDate: 'startDate',
    endDate: 'endDate',
    status: 'status',
  },
};

function parseDate(value: string | number | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocation(
  city?: string,
  state?: string,
  country?: string,
): string | null {
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapBullhornJob(
  raw: BullhornJob,
  mapping: BullhornMappingConfig['job'] = defaultMappingConfig.job,
): MappedJob {
  const address = raw[mapping.address ?? 'address'];
  const remoteHint = raw[mapping.remoteHint ?? 'customText10'];
  const company = raw[mapping.company ?? 'clientCorporation'] as
    | { name?: string }
    | undefined;

  return {
    id: String(raw[mapping.id]),
    title: String(raw[mapping.title]),
    employmentType: raw[mapping.employmentType ?? 'employmentType']?.toString() ?? null,
    location: formatLocation(
      (address as BullhornJob['address'])?.city,
      (address as BullhornJob['address'])?.state,
      (address as BullhornJob['address'])?.country,
    ),
    description: raw[mapping.description ?? 'description']?.toString() ?? null,
    postedAt: parseDate(raw[mapping.dateAdded ?? 'dateAdded'] as string | number | undefined),
    remote: Boolean(
      typeof remoteHint === 'string'
        ? /remote/i.test(remoteHint)
        : (remoteHint as boolean | undefined),
    ),
    company: company?.name ?? null,
  };
}

export function mapBullhornCandidate(
  raw: BullhornCandidate,
  mapping: BullhornMappingConfig['candidate'] = defaultMappingConfig.candidate,
): MappedCandidate {
  const city = raw[mapping.city ?? 'city']?.toString();
  const state = raw[mapping.state ?? 'state']?.toString();
  const country = raw[mapping.country ?? 'country']?.toString();

  return {
    id: String(raw[mapping.id]),
    fullName: `${raw[mapping.firstName]} ${raw[mapping.lastName]}`.trim(),
    email: raw[mapping.email ?? 'email']?.toString() ?? null,
    phone: raw[mapping.phone ?? 'phone']?.toString() ?? null,
    location: formatLocation(city, state, country),
    title: raw[mapping.occupation ?? 'occupation']?.toString() ?? null,
    source: raw[mapping.source ?? 'source']?.toString() ?? null,
    createdAt: parseDate(raw[mapping.dateAdded ?? 'dateAdded'] as string | number | undefined),
  };
}

export function mapBullhornPlacement(
  raw: BullhornPlacement,
  mapping: BullhornMappingConfig['placement'] = defaultMappingConfig.placement,
): MappedPlacement {
  const job = raw[mapping.job ?? 'jobOrder'] as BullhornPlacement['jobOrder'];
  const candidate = raw[mapping.candidate ?? 'candidate'] as BullhornPlacement['candidate'];

  return {
    id: String(raw[mapping.id]),
    jobId: job ? String(job.id) : null,
    candidateId: candidate ? String(candidate.id) : null,
    startDate: parseDate(raw[mapping.startDate ?? 'startDate'] as string | number | undefined),
    endDate: parseDate(raw[mapping.endDate ?? 'endDate'] as string | number | undefined),
    status: raw[mapping.status ?? 'status']?.toString() ?? null,
  };
}
