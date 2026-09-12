import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useOutletContext } from 'react-router-dom';
import { fetchTournament, updateTournament, deleteTournament, fetchTournamentAccess, fetchScoringConfig } from '../../services/tournamentApi.js';
import { completeTournament } from '../../services/archiveApi.js';
import {
  fetchCompetitionSummary,
  fetchRounds,
  createRound,
  updateRound,
  completeRound,
  deleteRound,
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  fetchEligibleTeams,
  autoAssignGroups,
  bulkMoveTeams,
  assignTeam,
  removeGroupTeam,
  fetchGroupMatches,
  createMatch,
  updateMatch,
  completeMatch,
  deleteMatch,
  createResult,
  fetchResults,
  fetchGroupLeaderboard,
  fetchRoundLeaderboard,
  fetchTournamentLeaderboard,
  fetchQualificationCenter,
  finalizeQualifications,
  reopenQualifications,
  createNextRound,
} from '../../services/competitionApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { CompetitionHeader } from '../../components/organizer/competition/CompetitionHeader.jsx';
import { CompetitionProgressTimeline } from '../../components/organizer/competition/CompetitionProgressTimeline.jsx';
import { RoundSelector } from '../../components/organizer/competition/RoundSelector.jsx';
import { CompetitionViewTabs } from '../../components/organizer/competition/CompetitionViewTabs.jsx';
import { GroupsView } from '../../components/organizer/competition/GroupsView.jsx';
import { MatchesView } from '../../components/organizer/competition/MatchesView.jsx';
import { StandingsView } from '../../components/organizer/competition/StandingsView.jsx';
import { QualificationView } from '../../components/organizer/competition/QualificationView.jsx';
import { NextRoundWizard } from '../../components/organizer/competition/NextRoundWizard.jsx';
import { CompetitionEmptyState } from '../../components/organizer/competition/CompetitionEmptyState.jsx';
import { TournamentCompletionModal } from '../../components/organizer/competition/TournamentCompletionModal.jsx';

export function OrganizerCompetitionPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const { joinTournament, leaveTournament, joinGroup, leaveGroup, on } = useSocket();

  // Access & Scout Permissions
  const [access, setAccess] = useState(outletCtx.effectiveAccess || null);
  const isScout = outletCtx.isScout ?? (access?.role === 'SCOUT');
  const permissions = new Set(access?.permissions || []);

  // Primary Data State
  const [tournament, setTournament] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [scoringConfig, setScoringConfig] = useState({ scoringMode: 'KILLS_AND_POSITION', killPointsPerKill: 1, positionPoints: [] });
  const [nextAction, setNextAction] = useState(null);

  // Selected Round Data
  const [groups, setGroups] = useState([]);
  const [eligibleTeams, setEligibleTeams] = useState([]);
  const [qualCenterData, setQualCenterData] = useState({ groups: [], qualifications: [] });
  const [roundLeaderboard, setRoundLeaderboard] = useState([]);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState([]);
  const [groupLeaderboardMap, setGroupLeaderboardMap] = useState({});

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals
  const [showCreateRoundModal, setShowCreateRoundModal] = useState(false);
  const [createRoundForm, setCreateRoundForm] = useState({ roundNumber: 1, name: 'Round 1' });
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const [completionLoading, setCompletionLoading] = useState(false);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Determine current navigation from URL params (SPA navigation without reloading)
  const paramRoundId = Number(searchParams.get('round')) || null;
  const paramView = searchParams.get('view') || 'groups'; // 'groups' | 'matches' | 'standings' | 'qualification'
  const paramGroupId = Number(searchParams.get('group')) || null;
  const paramGroupTab = searchParams.get('groupTab') || 'overview';

  // Helper to safely update URL query parameters without reloading
  const updateUrlState = useCallback(
    (updates) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  // Fetch access capabilities if not provided by outlet context
  useEffect(() => {
    if (!outletCtx.effectiveAccess && tournamentId) {
      fetchTournamentAccess(tournamentId)
        .then((data) => setAccess(data?.access || null))
        .catch(() => setAccess(null));
    } else if (outletCtx.effectiveAccess) {
      setAccess(outletCtx.effectiveAccess);
    }
  }, [tournamentId, outletCtx.effectiveAccess]);

  // 1. Load Tournament Summary & Rounds & Final Leaderboard
  const loadSummary = useCallback(async () => {
    if (!tournamentId) return;
    try {
      setLoading(true);
      setError('');

      const [tourneyRes, summaryRes, scoreRes, leaderRes] = await Promise.allSettled([
        fetchTournament(tournamentId),
        fetchCompetitionSummary(tournamentId),
        fetchScoringConfig(tournamentId),
        fetchTournamentLeaderboard(tournamentId),
      ]);

      if (tourneyRes.status === 'fulfilled' && tourneyRes.value?.tournament) {
        setTournament(tourneyRes.value.tournament);
      } else {
        throw new Error('Tournament not found or unauthorized.');
      }

      if (scoreRes.status === 'fulfilled' && scoreRes.value?.scoringConfig) {
        setScoringConfig(scoreRes.value.scoringConfig);
      }

      if (leaderRes.status === 'fulfilled' && leaderRes.value?.leaderboard) {
        setTournamentLeaderboard(leaderRes.value.leaderboard);
      }

      let summaryRounds = [];
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        summaryRounds = summaryRes.value.rounds || [];
        setRounds(summaryRounds);
        setNextAction(summaryRes.value.nextAction || null);
      } else {
        // Fallback to fetchRounds
        const fallback = await fetchRounds(tournamentId);
        summaryRounds = fallback.rounds || [];
        setRounds(summaryRounds);
      }

      // If no round is selected in URL, select active or first round
      if (summaryRounds.length > 0 && !searchParams.get('round')) {
        const active = summaryRounds.find((r) => r.status === 'IN_PROGRESS') || summaryRounds[0];
        updateUrlState({ round: active.id, view: searchParams.get('view') || 'groups' });
      }

      setCreateRoundForm({
        roundNumber: summaryRounds.length + 1,
        name: `Round ${summaryRounds.length + 1}`,
      });
    } catch (err) {
      setError(err.message || 'Failed to load tournament competition data.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, updateUrlState, searchParams]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Selected Round Object
  const selectedRound = rounds.find((r) => r.id === paramRoundId) || rounds[0] || null;
  const selectedRoundId = selectedRound?.id || null;

  // 2. Load Selected Round Granular Data (Groups, Eligible Teams, Qualifications, Standings)
  const loadRoundDetails = useCallback(async () => {
    if (!selectedRoundId) {
      setGroups([]);
      setEligibleTeams([]);
      setQualCenterData({ groups: [], qualifications: [] });
      setRoundLeaderboard([]);
      return;
    }

    try {
      const [groupsRes, eligibleRes, qualRes, leaderRes] = await Promise.allSettled([
        fetchGroups(selectedRoundId),
        fetchEligibleTeams(selectedRoundId),
        fetchQualificationCenter(selectedRoundId),
        fetchRoundLeaderboard(selectedRoundId),
      ]);

      if (groupsRes.status === 'fulfilled') {
        const grpList = groupsRes.value?.groups || [];
        setGroups(grpList);

        // Load individual group leaderboards in background
        const leaderMap = {};
        await Promise.all(
          grpList.map(async (g) => {
            try {
              const res = await fetchGroupLeaderboard(g.id);
              leaderMap[g.id] = res.leaderboard || [];
            } catch {
              leaderMap[g.id] = [];
            }
          })
        );
        setGroupLeaderboardMap(leaderMap);
      }

      if (eligibleRes.status === 'fulfilled') {
        setEligibleTeams(eligibleRes.value?.teams || []);
      }

      if (qualRes.status === 'fulfilled') {
        setQualCenterData(qualRes.value || { groups: [], qualifications: [] });
      }

      if (leaderRes.status === 'fulfilled') {
        setRoundLeaderboard(leaderRes.value?.leaderboard || []);
      }
    } catch (err) {
      console.error('Error loading round details:', err);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadRoundDetails();
  }, [loadRoundDetails]);

  // 3. Realtime Socket Connections & Event Listeners
  useEffect(() => {
    if (!tournamentId) return;

    joinTournament(tournamentId);
    if (paramGroupId) joinGroup(paramGroupId);

    // Named handlers for clean removal
    const handleMatchUpdate = (match) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === match.groupId) {
            const matches = g.matches || [];
            const exists = matches.some((m) => m.id === match.id);
            return {
              ...g,
              matches: exists ? matches.map((m) => (m.id === match.id ? match : m)) : [...matches, match],
            };
          }
          return g;
        })
      );
    };

    const handleMatchCreated = (match) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === match.groupId ? { ...g, matches: [...(g.matches || []), match] } : g))
      );
    };

    const handleMatchDeleted = ({ matchId }) => {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          matches: (g.matches || []).filter((m) => m.id !== matchId),
        }))
      );
    };

    const handleLeaderboardUpdate = ({ groupId, roundId: rId, leaderboard }) => {
      if (groupId) {
        setGroupLeaderboardMap((prev) => ({ ...prev, [groupId]: leaderboard || [] }));
      }
      if (rId && rId === selectedRoundId) {
        fetchRoundLeaderboard(rId).then((res) => setRoundLeaderboard(res.leaderboard || [])).catch(() => {});
      }
    };

    const handleGroupDeleted = ({ groupId }) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (paramGroupId === groupId) {
        updateUrlState({ group: null, groupTab: null });
      }
    };

    const handleRoundStatus = (round) => {
      setRounds((prev) => prev.map((r) => (r.id === round.id ? { ...r, ...round } : r)));
    };

    const handleNextRoundCreated = () => {
      loadSummary();
    };

    const removeMatchUpdate = on('match_update', handleMatchUpdate);
    const removeMatchCreated = on('match_created', handleMatchCreated);
    const removeMatchDeleted = on('match_deleted', handleMatchDeleted);
    const removeLeaderboard = on('leaderboard_update', handleLeaderboardUpdate);
    const removeGroupDel = on('group_deleted', handleGroupDeleted);
    const removeRoundStatus = on('round_status', handleRoundStatus);
    const removeNextRound = on('next_round_created', handleNextRoundCreated);
    const removeTourneyCompleted = on('tournament_completed', (data) => {
      setTournament((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
      if (data?.finalLeaderboard) {
        setTournamentLeaderboard(data.finalLeaderboard);
      }
      setNotice('Tournament completed and permanently archived.');
      loadSummary();
    });

    return () => {
      leaveTournament(tournamentId);
      if (paramGroupId) leaveGroup(paramGroupId);

      removeMatchUpdate();
      removeMatchCreated();
      removeMatchDeleted();
      removeLeaderboard();
      removeGroupDel();
      removeRoundStatus();
      removeNextRound();
      removeTourneyCompleted();
    };
  }, [tournamentId, selectedRoundId, paramGroupId, joinTournament, leaveTournament, joinGroup, leaveGroup, on, loadSummary, updateUrlState]);

  // Round Management Actions
  const handleSelectRound = (roundId) => {
    updateUrlState({ round: roundId, group: null, groupTab: null });
  };

  const handleStartTournamentLive = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await updateTournament(tournamentId, { status: 'LIVE' });
      setTournament(res.tournament);
      setNotice('Tournament is now LIVE! Competition operations and rounds are unlocked.');
    } catch (err) {
      setError(err.message || 'Failed to start tournament.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRound = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      if (tournament?.status !== 'LIVE') {
        if (!isScout || permissions.has('START_TOURNAMENT')) {
          const res = await updateTournament(tournamentId, { status: 'LIVE' });
          setTournament(res.tournament);
        } else {
          throw new Error('Tournament must be transitioned to LIVE before creating competition rounds.');
        }
      }
      const result = await createRound(tournamentId, {
        roundNumber: Number(createRoundForm.roundNumber),
        name: createRoundForm.name.trim(),
      });
      setRounds((prev) => [...prev, result.round]);
      setShowCreateRoundModal(false);
      setNotice(`Round "${result.round.name}" created successfully.`);
      updateUrlState({ round: result.round.id, view: 'groups' });
    } catch (err) {
      setError(err.message || 'Failed to create round.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRound = async (roundId) => {
    setActionLoading(true);
    try {
      const res = await updateRound(roundId, { status: 'IN_PROGRESS' });
      setRounds((prev) => prev.map((r) => (r.id === roundId ? res.round : r)));
      setNotice('Round started.');
    } catch (err) {
      setError(err.message || 'Failed to start round.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRound = async (roundId) => {
    // Check prerequisites
    const hasIncompleteGroups = groups.some((g) => g.status !== 'COMPLETED');
    if (hasIncompleteGroups) {
      setError('Every group must be completed before completing the round. Please complete pending groups first.');
      updateUrlState({ view: 'groups' });
      return;
    }

    if (!selectedRound?.qualificationsFinalizedAt) {
      setError('Qualifications must be finalized before completing the round. Please go to the Qualification tab to select and confirm advancing teams.');
      updateUrlState({ view: 'qualification' });
      return;
    }

    if (!window.confirm('Are you sure you want to complete this round? All matches and qualifications must be finalized.')) return;
    setActionLoading(true);
    try {
      const res = await completeRound(roundId);
      setRounds((prev) => prev.map((r) => (r.id === roundId ? res.round : r)));
      setNotice('Round marked as COMPLETED.');
    } catch (err) {
      setError(err.message || 'Failed to complete round.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTournament = async () => {
    setCompletionLoading(true);
    setCompletionError('');
    try {
      const res = await completeTournament(tournamentId);
      setShowCompletionModal(false);
      setTournament((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
      if (res.archive?.finalLeaderboard) {
        setTournamentLeaderboard(res.archive.finalLeaderboard);
      }
      setNotice('Tournament completed and permanently archived! Final leaderboard is preserved.');
      loadSummary();
    } catch (err) {
      setCompletionError(err.message || 'Failed to complete tournament.');
    } finally {
      setCompletionLoading(false);
    }
  };

  const handleDeleteRound = async (roundId) => {
    const id = typeof roundId === 'object' ? roundId?.id : roundId;
    const targetRound = rounds.find((r) => r.id === id);
    if (!window.confirm(`Are you sure you want to permanently delete "${targetRound?.name || `Round ${id}`}"? This will delete all associated groups and matches.`)) {
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await deleteRound(id);
      const remaining = rounds.filter((r) => r.id !== id);
      setRounds(remaining);
      setNotice(`Round deleted successfully.`);
      const nextRound = remaining[0];
      updateUrlState({ round: nextRound?.id || null, group: null, groupTab: null });
    } catch (err) {
      setError(err.message || 'Failed to delete round.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTournament = async () => {
    setActionLoading(true);
    setError('');
    try {
      await deleteTournament(tournamentId);
      navigate('/organizer/tournaments');
    } catch (err) {
      setError(err.message || 'Failed to delete tournament.');
      setShowDeleteModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Group Management Actions
  const handleAutoAssignGroups = async (config) => {
    if (!selectedRoundId) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await autoAssignGroups(selectedRoundId, config);
      setGroups(res.groups || []);
      setNotice(`Successfully created ${res.groups?.length || 0} groups with balanced assignments.`);
      loadRoundDetails();
    } catch (err) {
      setError(err.message || 'Failed to generate group assignments.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveTeam = async (teamId, targetGroupId) => {
    if (!selectedRoundId) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await bulkMoveTeams(selectedRoundId, {
        teamIds: [Number(teamId)],
        targetGroupId: Number(targetGroupId),
      });
      setGroups(res.groups || []);
      setNotice('Team moved to new group successfully.');
      loadRoundDetails();
    } catch (err) {
      setError(err.message || 'Failed to move team.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTeam = async (groupId, teamId) => {
    if (!window.confirm('Remove this team from the group?')) return;
    setActionLoading(true);
    try {
      const res = await removeGroupTeam(groupId, teamId);
      setGroups((prev) => prev.map((g) => (g.id === groupId ? res.group : g)));
      setNotice('Team removed from group.');
    } catch (err) {
      setError(err.message || 'Failed to remove team.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateGroupRoom = async (groupId, roomData) => {
    setActionLoading(true);
    try {
      const res = await updateGroup(groupId, roomData);
      setGroups((prev) => prev.map((g) => (g.id === groupId ? res.group : g)));
      setNotice('Room credentials saved and broadcasted.');
    } catch (err) {
      setError(err.message || 'Failed to update room credentials.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    setActionLoading(true);
    try {
      await deleteGroup(deleteConfirmGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== deleteConfirmGroup.id));
      if (paramGroupId === deleteConfirmGroup.id) {
        updateUrlState({ group: null, groupTab: null });
      }
      setNotice(`Group "${deleteConfirmGroup.name}" deleted.`);
      setDeleteConfirmGroup(null);
    } catch (err) {
      setError(err.message || 'Failed to delete group.');
    } finally {
      setActionLoading(false);
    }
  };

  // Match Management Actions
  const handleSaveMatch = async (grpId, matchData, matchId) => {
    setActionLoading(true);
    setError('');
    try {
      if (matchId) {
        const res = await updateMatch(matchId, matchData);
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            matches: (g.matches || []).map((m) => (m.id === matchId ? res.match : m)),
          }))
        );
        setNotice('Match updated.');
      } else {
        const res = await createMatch(grpId, matchData);
        setGroups((prev) =>
          prev.map((g) => (g.id === grpId ? { ...g, matches: [...(g.matches || []), res.match] } : g))
        );
        setNotice('New match created.');
      }
    } catch (err) {
      setError(err.message || 'Failed to save match.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async (matchId) => {
    setActionLoading(true);
    try {
      const res = await updateMatch(matchId, { status: 'LIVE' });
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          matches: (g.matches || []).map((m) => (m.id === matchId ? res.match : m)),
        }))
      );
      setNotice('Match is now LIVE.');
    } catch (err) {
      setError(err.message || 'Failed to start match.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveScore = async (matchId, scorePayload) => {
    setActionLoading(true);
    try {
      const res = await createResult(matchId, scorePayload);
      setNotice(`Score saved for team.`);
      // Update standings
      loadRoundDetails();
      return res;
    } catch (err) {
      setError(err.message || 'Failed to record score.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMatch = async (matchOrId) => {
    const matchId = typeof matchOrId === 'object' ? matchOrId?.id : matchOrId;
    if (typeof matchOrId === 'object' && !window.confirm(`Delete match "${matchOrId?.name || `Match ${matchId}`}"?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteMatch(matchId);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          matches: (g.matches || []).filter((m) => m.id !== matchId),
        }))
      );
      setNotice('Match deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete match.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Qualification Actions
  const handleFinalizeQualifications = async (roundId, selections) => {
    setActionLoading(true);
    setError('');
    try {
      await finalizeQualifications(roundId, { selections });
      setNotice('Qualifications finalized successfully.');
      loadSummary();
      loadRoundDetails();
    } catch (err) {
      setError(err.message || 'Failed to finalize qualifications.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenQualifications = async (roundId) => {
    setActionLoading(true);
    setError('');
    try {
      await reopenQualifications(roundId);
      setNotice('Qualifications reopened.');
      loadSummary();
      loadRoundDetails();
    } catch (err) {
      setError(err.message || 'Failed to reopen qualifications.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Next Round Creation
  const handleCreateNextRound = async (input) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await createNextRound(tournamentId, input);
      setNotice(`Round "${res.round?.name}" created successfully.`);
      setShowNextRoundModal(false);
      loadSummary();
      updateUrlState({ round: res.round?.id, view: 'groups' });
    } catch (err) {
      setError(err.message || 'Failed to create next round.');
    } finally {
      setActionLoading(false);
    }
  };

  // Next Action Handler
  const handleExecuteNextAction = (action) => {
    if (!action) return;
    switch (action.type) {
      case 'OPEN_REGISTRATION':
      case 'REVIEW_REGISTRATIONS':
        navigate(`/organizer/tournaments/${tournamentId}/registrations`);
        break;
      case 'START_TOURNAMENT':
        navigate(`/organizer/tournaments/${tournamentId}`);
        break;
      case 'CREATE_ROUND_1':
        setShowCreateRoundModal(true);
        break;
      case 'CREATE_GROUPS':
      case 'ASSIGN_TEAMS':
        updateUrlState({ view: 'groups', group: null });
        break;
      case 'CREATE_MATCHES':
      case 'REVIEW_MATCH_RESULTS':
      case 'MONITOR_LIVE':
        updateUrlState({ view: 'matches' });
        break;
      case 'SELECT_QUALIFIED_TEAMS':
        updateUrlState({ view: 'qualification' });
        break;
      case 'CREATE_NEXT_ROUND':
        setShowNextRoundModal(true);
        break;
      case 'MANAGE_NEXT_ROUND':
        if (action.roundId) updateUrlState({ round: action.roundId, view: 'groups' });
        break;
      case 'COMPLETE_TOURNAMENT':
        setShowCompletionModal(true);
        break;
      default:
        break;
    }
  };

  const isReadOnly = tournament?.status === 'COMPLETED';

  // Permissions Map
  const canCreateRound = !isScout || permissions.has('CREATE_ROUND');
  const canManageRound = !isScout || permissions.has('EDIT_ROUND');
  const canCreateGroups = !isScout || permissions.has('CREATE_GROUP');
  const canAssignTeams = !isScout || permissions.has('ASSIGN_TEAMS');
  const canManageRoom = !isScout || permissions.has('EDIT_ROOM');
  const canCreateMatches = !isScout || permissions.has('CREATE_MATCH');
  const canEnterResults = !isScout || permissions.has('ENTER_RESULTS');
  const canManageQualifications = !isScout || permissions.has('MANAGE_QUALIFICATIONS');
  const canDelete = !isScout;

  // Aggregate Stats
  const totalRoundTeams = groups.reduce((acc, g) => acc + (g.teams?.length || 0), 0);
  const allMatches = groups.flatMap((g) => g.matches || []);
  const completedMatches = allMatches.filter((m) => m.status === 'COMPLETED').length;
  const liveMatches = allMatches.filter((m) => m.status === 'LIVE').length;
  const qualifiedCount = qualCenterData.qualifications?.length || 0;

  if (loading && !tournament) {
    return (
      <section className="comp-workspace">
        <p className="comp-empty-state-title" style={{ padding: '60px 0', textAlign: 'center' }}>
          Loading Tournament Competition Workspace...
        </p>
      </section>
    );
  }

  return (
    <section className="comp-workspace" aria-label="Tournament Competition Workspace">
      {/* Breadcrumb */}
      <nav className="comp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/organizer">Organizer</Link>
        <span className="comp-breadcrumb-separator">/</span>
        <Link to="/organizer/tournaments">Tournaments</Link>
        <span className="comp-breadcrumb-separator">/</span>
        <Link to={`/organizer/tournaments/${tournamentId}`}>{tournament?.name || 'Tournament'}</Link>
        <span className="comp-breadcrumb-separator">/</span>
        <span className="comp-breadcrumb-current">Competition Control Center</span>
      </nav>

      {/* Header with Next Action & Stats */}
      <CompetitionHeader
        tournament={tournament}
        activeRound={selectedRound}
        totalGroups={groups.length}
        totalTeams={totalRoundTeams}
        completedMatches={completedMatches}
        totalMatches={allMatches.length}
        liveMatches={liveMatches}
        nextAction={nextAction}
        onExecuteNextAction={handleExecuteNextAction}
        isScout={isScout}
        permissions={permissions}
        isReadOnly={isReadOnly}
        onOpenCompleteModal={() => setShowCompletionModal(true)}
        onOpenDeleteModal={() => setShowDeleteModal(true)}
        error={error}
        notice={notice}
        onClearNotice={() => setNotice('')}
      />

      {/* Lifecycle Action Notice for Non-Live Tournaments */}
      {tournament && tournament.status !== 'LIVE' && tournament.status !== 'COMPLETED' && (
        <div style={{
          background: 'rgba(246, 196, 83, 0.1)',
          border: '1px solid rgba(246, 196, 83, 0.3)',
          borderRadius: '8px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <strong style={{ color: '#f6c453' }}>Tournament Status: {tournament.status.replaceAll('_', ' ')}</strong>
            <span style={{ color: '#cdd6e2', marginLeft: '8px', fontSize: '13px' }}>
              Tournaments must be transitioned to <strong>LIVE</strong> status for round creation and match management.
            </span>
          </div>
          {(!isScout || permissions.has('START_TOURNAMENT')) && (
            <button
              className="button primary-button"
              style={{ minHeight: '34px', padding: '0 14px', fontSize: '13px' }}
              disabled={actionLoading}
              onClick={handleStartTournamentLive}
            >
              {actionLoading ? 'Starting...' : 'Start Tournament (LIVE) →'}
            </button>
          )}
        </div>
      )}

      {/* Progression Timeline */}
      <CompetitionProgressTimeline tournament={tournament} rounds={rounds} />

      {/* Round Selector Strip */}
      <RoundSelector
        rounds={rounds}
        selectedRoundId={selectedRoundId}
        onSelectRound={handleSelectRound}
        onCreateRoundClick={() => setShowCreateRoundModal(true)}
        onStartRound={handleStartRound}
        onCompleteRound={handleCompleteRound}
        onDeleteRound={handleDeleteRound}
        isReadOnly={isReadOnly}
        canCreateRound={canCreateRound}
        canManageRound={canManageRound}
      />

      {/* Sub-Navigation Tabs: [Groups] [Matches] [Standings] [Qualification] */}
      {selectedRound && (
        <CompetitionViewTabs
          activeView={paramView}
          onSelectView={(v) => updateUrlState({ view: v, group: null, groupTab: null })}
          groupCount={groups.length}
          matchCount={allMatches.length}
          qualifiedCount={qualifiedCount}
          isScout={isScout}
          permissions={permissions}
        />
      )}

      {/* Main Workspace Body Based on Selected View */}
      {rounds.length === 0 ? (
        <CompetitionEmptyState
          title="No Rounds Created"
          description="Initialize Round 1 to start setting up competition groups and matches."
          actionLabel={!isReadOnly && canCreateRound ? "+ Create Round 1" : ""}
          onAction={() => setShowCreateRoundModal(true)}
        />
      ) : (
        <>
          {/* 1. Groups View */}
          {paramView === 'groups' && (
            <GroupsView
              round={selectedRound}
              groups={groups}
              eligibleTeams={eligibleTeams}
              selectedGroupId={paramGroupId}
              onSelectGroup={(gId) => updateUrlState({ group: gId, groupTab: 'overview' })}
              activeGroupTab={paramGroupTab}
              onSelectGroupTab={(tab) => updateUrlState({ groupTab: tab })}
              onBackToGroups={() => updateUrlState({ group: null, groupTab: null })}
              onAutoAssign={handleAutoAssignGroups}
              onMoveTeamConfirm={handleMoveTeam}
              onRemoveTeam={handleRemoveTeam}
              onUpdateGroupRoom={handleUpdateGroupRoom}
              onStartMatch={handleStartMatch}
              onOpenScoreModal={() => updateUrlState({ view: 'matches' })}
              onOpenMatchModal={() => updateUrlState({ view: 'matches' })}
              onDeleteMatch={handleDeleteMatch}
              onDeleteGroup={(grp) => setDeleteConfirmGroup(grp)}
              onCompleteGroup={async (gId) => {
                try {
                  const res = await updateGroup(gId, { status: 'COMPLETED' });
                  setGroups((prev) => prev.map((g) => (g.id === gId ? res.group : g)));
                  setNotice('Group marked COMPLETED.');
                } catch (err) {
                  setError(err.message || 'Failed to complete group.');
                }
              }}
              groupLeaderboard={groupLeaderboardMap[paramGroupId] || []}
              scoringMode={scoringConfig.scoringMode}
              isReadOnly={isReadOnly}
              canCreateGroups={canCreateGroups}
              canAssignTeams={canAssignTeams}
              canManageRoom={canManageRoom}
              canManageMatches={canCreateMatches}
              canDelete={canDelete}
              actionLoading={actionLoading}
            />
          )}

          {/* 2. Matches View */}
          {paramView === 'matches' && (
            <MatchesView
              round={selectedRound}
              groups={groups}
              onSaveMatch={handleSaveMatch}
              onStartMatch={handleStartMatch}
              onSaveScore={handleSaveScore}
              onDeleteMatch={handleDeleteMatch}
              scoringConfig={scoringConfig}
              isReadOnly={isReadOnly}
              canCreateMatches={canCreateMatches}
              canEnterResults={canEnterResults}
              actionLoading={actionLoading}
            />
          )}

          {/* 3. Standings View */}
          {paramView === 'standings' && (
            <StandingsView
              round={selectedRound}
              groups={groups}
              roundLeaderboard={roundLeaderboard}
              tournamentLeaderboard={tournamentLeaderboard}
              isCompleted={isReadOnly}
              scoringMode={scoringConfig.scoringMode}
              groupLeaderboardMap={groupLeaderboardMap}
              loading={actionLoading}
            />
          )}

          {/* 4. Qualification View */}
          {paramView === 'qualification' && (
            <div>
              <QualificationView
                round={selectedRound}
                qualCenterData={qualCenterData}
                onFinalizeQualifications={handleFinalizeQualifications}
                onReopenQualifications={handleReopenQualifications}
                onCompleteGroup={async (gId) => {
                  try {
                    const res = await updateGroup(gId, { status: 'COMPLETED' });
                    setGroups((prev) => prev.map((g) => (g.id === gId ? res.group : g)));
                    setNotice('Group marked COMPLETED.');
                    loadRoundDetails();
                  } catch (err) {
                    setError(err.message || 'Failed to complete group.');
                  }
                }}
                isReadOnly={isReadOnly}
                canManageQualifications={canManageQualifications}
                loading={actionLoading}
              />

              {/* Show Next Round trigger banner when finalized */}
              {selectedRound?.qualificationsFinalizedAt && (
                <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>
                      Qualifications Confirmed: {qualifiedCount} Teams Advancing
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#91a0b3' }}>
                      Ready to advance these {qualifiedCount} qualified teams into the next round of competition.
                    </p>
                  </div>
                  {!isReadOnly && canCreateRound && (
                    <button
                      className="button primary-button"
                      type="button"
                      onClick={() => setShowNextRoundModal(true)}
                    >
                      Create Round {(selectedRound?.roundNumber || 1) + 1} Wizard →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Round Modal */}
      {showCreateRoundModal && (
        <div className="comp-modal-overlay" role="dialog" aria-modal="true">
          <div className="comp-modal" style={{ maxWidth: '440px' }}>
            <div className="comp-modal-header">
              <h2 className="comp-modal-title">Create New Round</h2>
              <button className="comp-modal-close" onClick={() => setShowCreateRoundModal(false)} type="button">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRound}>
              <div className="comp-form-group">
                <label className="comp-label">Round Number</label>
                <input
                  className="comp-input"
                  type="number"
                  min="1"
                  value={createRoundForm.roundNumber}
                  onChange={(e) => setCreateRoundForm((f) => ({ ...f, roundNumber: e.target.value }))}
                  required
                />
              </div>
              <div className="comp-form-group">
                <label className="comp-label">Round Name</label>
                <input
                  className="comp-input"
                  type="text"
                  value={createRoundForm.name}
                  onChange={(e) => setCreateRoundForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="comp-modal-footer">
                <button className="button secondary-button" type="button" onClick={() => setShowCreateRoundModal(false)}>
                  Cancel
                </button>
                <button className="button primary-button" type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Round'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Next Round Wizard Modal */}
      <NextRoundWizard
        isOpen={showNextRoundModal}
        onClose={() => setShowNextRoundModal(false)}
        currentRound={selectedRound}
        qualifiedTeamsCount={qualifiedCount}
        onCreateNextRound={handleCreateNextRound}
        loading={actionLoading}
      />

      {/* Delete Group Modal */}
      {deleteConfirmGroup && (
        <div className="comp-modal-overlay" role="dialog" aria-modal="true">
          <div className="comp-modal" style={{ maxWidth: '440px' }}>
            <div className="comp-modal-header">
              <h2 className="comp-modal-title">Delete {deleteConfirmGroup.name}?</h2>
              <button className="comp-modal-close" onClick={() => setDeleteConfirmGroup(null)} type="button">
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#8b949e', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              This will remove team assignments and associated matches for this group. Groups with recorded match results cannot be deleted.
            </p>
            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={() => setDeleteConfirmGroup(null)}>
                Cancel
              </button>
              <button
                className="button ghost-button"
                type="button"
                style={{ color: '#ff7b72', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                disabled={actionLoading}
                onClick={handleDeleteGroup}
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize & Complete Tournament Modal */}
      <TournamentCompletionModal
        isOpen={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false);
          setCompletionError('');
        }}
        onConfirm={handleCompleteTournament}
        tournament={tournament}
        rounds={rounds}
        groups={groups}
        leaderboard={tournamentLeaderboard}
        loading={completionLoading}
        error={completionError}
      />

      {/* Delete Tournament Modal */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div
            style={{
              background: '#1c2128',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '28px',
              width: 'min(480px, 100%)',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#ef4444', fontSize: '20px' }}>Delete Tournament</h3>
            </div>

            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to permanently delete <strong>"{tournament?.name}"</strong>?
            </p>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '13px',
                color: '#fca5a5',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              <strong>Warning:</strong> This will permanently delete all {rounds.length} rounds, competition groups, scheduled matches, and team registrations. This action cannot be reversed.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteTournament}
                disabled={actionLoading}
                style={{ minWidth: '140px' }}
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
