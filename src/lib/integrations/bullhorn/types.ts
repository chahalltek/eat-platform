export interface BullhornAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface BullhornJob {
  id: number;
  title: string;
  employmentType?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  description?: string;
  dateAdded?: string | number;
  isOpen?: boolean;
  customText10?: string; // remote indicator in many ATS setups
  clientCorporation?: {
    name?: string;
  };
}

export interface BullhornCandidate {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  dateAdded?: string | number;
  occupation?: string;
  source?: string;
}

export interface BullhornPlacement {
  id: number;
  jobOrder?: BullhornJob;
  candidate?: BullhornCandidate;
  startDate?: string | number;
  endDate?: string | number;
  status?: string;
}

export interface BullhornHttpAdapter {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface MappedJob {
  id: string;
  title: string;
  employmentType: string | null;
  location: string | null;
  description: string | null;
  postedAt: Date | null;
  remote: boolean;
  company?: string | null;
}

export interface MappedCandidate {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  source: string | null;
  createdAt: Date | null;
}

export interface MappedPlacement {
  id: string;
  jobId: string | null;
  candidateId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string | null;
}

export interface BullhornMappingConfig {
  job: {
    id: keyof BullhornJob;
    title: keyof BullhornJob;
    employmentType?: keyof BullhornJob;
    address?: keyof BullhornJob;
    description?: keyof BullhornJob;
    dateAdded?: keyof BullhornJob;
    remoteHint?: keyof BullhornJob;
    company?: keyof BullhornJob;
  };
  candidate: {
    id: keyof BullhornCandidate;
    firstName: keyof BullhornCandidate;
    lastName: keyof BullhornCandidate;
    email?: keyof BullhornCandidate;
    phone?: keyof BullhornCandidate;
    city?: keyof BullhornCandidate;
    state?: keyof BullhornCandidate;
    country?: keyof BullhornCandidate;
    dateAdded?: keyof BullhornCandidate;
    occupation?: keyof BullhornCandidate;
    source?: keyof BullhornCandidate;
  };
  placement: {
    id: keyof BullhornPlacement;
    job?: keyof BullhornPlacement;
    candidate?: keyof BullhornPlacement;
    startDate?: keyof BullhornPlacement;
    endDate?: keyof BullhornPlacement;
    status?: keyof BullhornPlacement;
  };
}

export interface SyncStore {
  upsertJobs(jobs: MappedJob[]): Promise<void>;
  upsertCandidates(candidates: MappedCandidate[]): Promise<void>;
  upsertPlacements(placements: MappedPlacement[]): Promise<void>;
}

export interface SyncSummary {
  jobsSynced: number;
  candidatesSynced: number;
  placementsSynced: number;
}
