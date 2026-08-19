import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { AuthenticatedLayout } from '../layouts/AuthenticatedLayout.jsx';
import { LandingPage } from '../pages/public/LandingPage.jsx';
import { LoginPage } from '../pages/public/LoginPage.jsx';
import { SignupPage } from '../pages/public/SignupPage.jsx';
import { NotFoundPage } from '../pages/public/NotFoundPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { PlayerOverviewPage, PlayerWorkspacePage } from '../pages/player/PlayerWorkspacePage.jsx';
import { PlayerDashboardPage } from '../pages/player/PlayerDashboardPage.jsx';
import { TeamsPage } from '../pages/player/TeamsPage.jsx';
import { TournamentsPage } from '../pages/public/TournamentsPage.jsx';
import { TournamentDetailsPage } from '../pages/public/TournamentDetailsPage.jsx';
import { OrganizerWorkspacePage } from '../pages/organizer/OrganizerWorkspacePage.jsx';
import { OrganizerOverviewPage } from '../pages/organizer/OrganizerOverviewPage.jsx';
import { OrganizerTournamentPage } from '../pages/organizer/OrganizerTournamentPage.jsx';
import { OrganizerTournamentsPage } from '../pages/organizer/OrganizerTournamentsPage.jsx';
import { OrganizerRoundsPage } from '../pages/organizer/OrganizerRoundsPage.jsx';
import { OrganizerGroupsPage } from '../pages/organizer/OrganizerGroupsPage.jsx';
import { OrganizerGroupPage } from '../pages/organizer/OrganizerGroupPage.jsx';
import { OrganizerMatchResultsPage } from '../pages/organizer/OrganizerMatchResultsPage.jsx';
import { OrganizerQualificationsPage } from '../pages/organizer/OrganizerQualificationsPage.jsx';
import { OrganizerCompletionPage } from '../pages/organizer/OrganizerCompletionPage.jsx';
import { HistoryPage, HistoryDetailPage } from '../pages/public/HistoryPage.jsx';
import { SocketProvider } from '../context/SocketContext.jsx';
import { OrganizerAnnouncementsPage } from '../pages/organizer/OrganizerAnnouncementsPage.jsx';
import { GroupChatPage } from '../pages/organizer/GroupChatPage.jsx';
import { NotificationsPage } from '../pages/public/NotificationsPage.jsx';
import { OrganizerRegistrationsPage } from '../pages/organizer/OrganizerRegistrationsPage.jsx';
import { PlayerGroupPage } from '../pages/player/PlayerGroupPage.jsx';
import { TournamentHubPage } from '../pages/player/TournamentHubPage.jsx';
import { MyTournamentsPage } from '../pages/player/MyTournamentsPage.jsx';

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="tournaments/:tournamentId" element={<TournamentDetailsPage />} />
        </Route>
        <Route path="/player" element={<PlayerWorkspacePage />}>
          <Route index element={<PlayerOverviewPage />} />
          <Route path="dashboard" element={<PlayerDashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="my-tournaments" element={<MyTournamentsPage />} />
          <Route path="groups/:groupId" element={<PlayerGroupPage />} />
          <Route path="communications/:tournamentId" element={<TournamentHubPage />} />
          <Route path="groups/:groupId/chat" element={<GroupChatPage />} />
        </Route>
        <Route path="/organizer" element={<OrganizerWorkspacePage />}>
          <Route index element={<OrganizerOverviewPage />} />
          <Route path="tournaments" element={<OrganizerTournamentsPage />} />
          <Route path="tournaments/:tournamentId" element={<OrganizerTournamentPage />} />
          <Route path="tournaments/:tournamentId/registrations" element={<OrganizerRegistrationsPage />} />
          <Route path="tournaments/:tournamentId/rounds" element={<OrganizerRoundsPage />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/groups" element={<OrganizerGroupsPage />} />
          <Route path="tournaments/:tournamentId/groups/:groupId" element={<OrganizerGroupPage />} />
          <Route path="tournaments/:tournamentId/matches/:matchId" element={<OrganizerMatchResultsPage />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/qualifications" element={<OrganizerQualificationsPage />} />
          <Route path="tournaments/:tournamentId/complete" element={<OrganizerCompletionPage />} />
          <Route path="tournaments/:tournamentId/announcements" element={<OrganizerAnnouncementsPage />} />
          <Route path="tournaments/:tournamentId/groups/:groupId/chat" element={<GroupChatPage />} />
        </Route>
        <Route path="/organizer/*" element={<OrganizerWorkspacePage />} />
        <Route path="history" element={<AuthenticatedLayout />}>
          <Route index element={<HistoryPage />} />
          <Route path=":historyId" element={<HistoryDetailPage />} />
        </Route>
        <Route path="notifications" element={<AuthenticatedLayout />}><Route index element={<NotificationsPage />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
