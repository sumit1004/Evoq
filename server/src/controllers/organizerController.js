import { asyncHandler } from '../utils/asyncHandler.js';
import { getOrganizerDashboard } from '../services/organizerDashboardService.js';

export const getDashboardController = asyncHandler(async (req, res) => {
  res.status(200).json({ dashboard: await getOrganizerDashboard(req.user.id) });
});
