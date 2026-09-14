import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { SchoolInfo } from '../utils/schoolDocument';

export function useSchool() {
  return useQuery<SchoolInfo>({
    queryKey: ['institution-settings'],
    queryFn: () => api.get('/settings/institution').then((r) => r.data),
  });
}
