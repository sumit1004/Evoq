import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { AuthenticatedLayout } from '../layouts/AuthenticatedLayout.jsx';
import { LandingPage } from '../pages/public/LandingPage.jsx';
import { LoginPage } from '../pages/public/LoginPage.jsx';
import { SignupPage } from '../pages/public/SignupPage.jsx';
import { NotFoundPage } from '../pages/public/NotFoundPage.jsx';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { PlayerOverviewPage, PlayerWorkspacePage } from '../pages/player/PlayerWorkspacePage.jsx';
import { PlayerDashboardPage } from '../pages/player/PlayerDashboardPage.jsx';
import { TeamsPage } from '../pages/player/TeamsPage.jsx';
import { TournamentsPage } from '../pages/public/TournamentsPage.jsx';
import { TournamentDetailsPage } from '../pages/public/TournamentDetailsPage.jsx';
import { OrganizerWorkspacePage } from '../pages/organizer/OrganizerWorkspacePage.jsx';
import { OrganizerOverviewPage } from '../pages/organizer/OrganizerOverviewPage.jsx';
import { OrganizerTournamentPage } from '../pages/organizer/OrganizerTournamentPage.jsx';
import { OrganizerTournamentsPage } from '../pages/organizer/OrganizerTournamentsPage.jsx';
import { OrganizerCompletionPage } from '../pages/organizer/OrganizerCompletionPage.jsx';
import { HistoryPage, HistoryDetailPage } from '../pages/public/HistoryPage.jsx';
import { SocketProvider } from '../context/SocketContext.jsx';
import { OrganizerAnnouncementsPage } from '../pages/organizer/OrganizerAnnouncementsPage.jsx';
import { GroupChatPage } from '../pages/organizer/GroupChatPage.jsx';
import { NotificationsPage } from '../pages/public/NotificationsPage.jsx';
import { OrganizerRegistrationsPage } from '../pages/organizer/OrganizerRegistrationsPage.jsx';
import { OrganizerScoutsPage } from '../pages/organizer/OrganizerScoutsPage.jsx';
import { ScoutWorkspacePage } from '../pages/scout/ScoutWorkspacePage.jsx';
import { ScoutTournamentPage } from '../pages/scout/ScoutTournamentPage.jsx';
import { PlayerGroupPage } from '../pages/player/PlayerGroupPage.jsx';
import { TournamentHubPage } from '../pages/player/TournamentHubPage.jsx';
import { MyTournamentsPage } from '../pages/player/MyTournamentsPage.jsx';

function TournamentRoundsRedirect() {
  const { tournamentId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds`} replace />;
}

function RoundRedirect() {
  const { tournamentId, roundId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds&round=${roundId}&section=overview`} replace />;
}

function RoundGroupsRedirect() {
  const { tournamentId, roundId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds&round=${roundId}&section=groups`} replace />;
}

function RoundQualificationsRedirect() {
  const { tournamentId, roundId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds&round=${roundId}&section=qualifications`} replace />;
}

function LegacyGroupRedirect() {
  const { tournamentId, roundId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds${roundId ? `&round=${roundId}` : ''}&section=groups`} replace />;
}

function LegacyMatchRedirect() {
  const { tournamentId, roundId } = useParams();
  return <Navigate to={`/organizer/tournaments/${tournamentId}?tab=rounds${roundId ? `&round=${roundId}` : ''}&section=groups`} replace />;
}

export function AppContent() {

  const { serverError, retry } = useAuth();
  return (
    <>
      {serverError && (
        <div className="connection-error-banner" style={{ background: '#e74c3c', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', zIndex: 9999, position: 'sticky', top: 0 }}>
          <span>Server is temporarily unavailable. Please check your connection.</span>
          <button className="button secondary-button" style={{ minHeight: '28px', padding: '0 12px', fontSize: '12px', background: '#fff', color: '#e74c3c', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }} onClick={retry}>
            Retry
          </button>
        </div>
      )}
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
        </Route>
        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="tournaments/:tournamentId" element={<TournamentDetailsPage />} />
        <Route path="/player" element={<PlayerWorkspacePage />}>
          <Route index element={<PlayerOverviewPage />} />
          <Route path="dashboard" element={<PlayerDashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="my-tournaments" element={<MyTournamentsPage />} />
          <Route path="groups/:groupId" element={<PlayerGroupPage />} />
          <Route path="communications/:tournamentId" element={<TournamentHubPage />} />
          <Route path="tournaments/:tournamentId" element={<TournamentHubPage />} />
          <Route path="groups/:groupId/chat" element={<GroupChatPage />} />
        </Route>
        <Route path="/organizer" element={<OrganizerWorkspacePage />}>
          <Route index element={<OrganizerOverviewPage />} />
          <Route path="tournaments" element={<OrganizerTournamentsPage />} />
          <Route path="scouts" element={<OrganizerScoutsPage />} />
          <Route path="tournaments/:tournamentId" element={<OrganizerTournamentPage />} />
          <Route path="tournaments/:tournamentId/registrations" element={<OrganizerRegistrationsPage />} />
          <Route path="tournaments/:tournamentId/rounds" element={<TournamentRoundsRedirect />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId" element={<RoundRedirect />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/groups" element={<RoundGroupsRedirect />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/groups/:groupId" element={<LegacyGroupRedirect />} />
          <Route path="tournaments/:tournamentId/groups/:groupId" element={<LegacyGroupRedirect />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/groups/:groupId/matches/:matchId" element={<LegacyMatchRedirect />} />
          <Route path="tournaments/:tournamentId/matches/:matchId" element={<LegacyMatchRedirect />} />
          <Route path="tournaments/:tournamentId/rounds/:roundId/qualifications" element={<RoundQualificationsRedirect />} />
          <Route path="tournaments/:tournamentId/complete" element={<OrganizerCompletionPage />} />
          <Route path="tournaments/:tournamentId/announcements" element={<OrganizerAnnouncementsPage />} />
          <Route path="tournaments/:tournamentId/groups/:groupId/chat" element={<GroupChatPage />} />
        </Route>
        <Route path="/organizer/*" element={<OrganizerWorkspacePage />} />
        <Route path="/scout" element={<ScoutWorkspacePage />} />
        <Route path="/scout/tournaments" element={<ScoutWorkspacePage />} />
        <Route path="/scout/tournaments/:tournamentId" element={<ScoutTournamentPage />} />
        <Route path="history" element={<AuthenticatedLayout />}>
          <Route index element={<HistoryPage />} />
          <Route path=":historyId" element={<HistoryDetailPage />} />
        </Route>
        <Route path="notifications" element={<AuthenticatedLayout />}><Route index element={<NotificationsPage />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
