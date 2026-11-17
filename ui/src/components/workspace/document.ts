import type { CandidateProfile } from '../../services/api';

export interface ResumeVersion {
  id: number;
  at: number;
  profile: CandidateProfile;
}