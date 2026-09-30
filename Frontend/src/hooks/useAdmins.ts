import { queryOptions } from '@tanstack/react-query';
import { settingsService } from '../services';

export const adminsQuery = () => queryOptions({
  queryKey: ['admins'],
  queryFn: async () => {
    const response = await settingsService.getAllAdmins();
    return response.admins || [];
  },
});
