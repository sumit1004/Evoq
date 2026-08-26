import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  assignTeam,
  autoAssignGroups,
  bulkMoveTeams,
  completeGroup,
  completeMatch,
  completeRound,
  createGroup,
  createMatch,
  createNextRound,
  createResult,
  createRound,
  deleteGroup,
  deleteMatch,
  deleteRound,
  fetchEligibleTeams,
  fetchGroup,
  fetchGroupLeaderboard,
  fetchGroupMatches,
  fetchGroups,
  fetchMatch,
  fetchMatchLeaderboard,
  fetchQualificationCenter,
  fetchResults,
  fetchRounds,
  finalizeQualifications,
  getRound,
  lockRoundAssignment,
  notifyMatchSchedule,
  recalculateLeaderboard,
  removeGroupTeam,
  reopenQualifications,
  updateGroup,
  updateMatch,
  updateRound,
} from '../../services/competitionApi.js';
import { RoundSetupWizard } from './RoundSetupWizard.jsx';
import { AssignmentWorkspace } from './AssignmentWorkspace.jsx';
import { QualificationCenterView } from './QualificationCenterView.jsx';
import { NextRoundModal } from './NextRoundModal.jsx';
import { GroupChatView } from '../GroupChatView.jsx';

export function OrganizerRoundsHub({ tournamentId, tournamentStatus }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation State
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'groups' | 'qualifications'

  // Selected Round Data
  const [selectedRound, setSelectedRound] = useState(null);
  const [groups, setGroups] = useState([]);
  const [eligibleTeams, setEligibleTeams] = useState([]);
  const [qualCenterData, setQualCenterData] = useState({ groups: [], qualifications: [] });

  // Modals & Drawers
  const [showCreateRoundModal, setShowCreateRoundModal] = useState(false);
  const [createRoundForm, setCreateRoundForm] = useState({ roundNumber: 1, name: 'Round 1' });

  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', groupSize: 12 });

  const [showGroupConfig, setShowGroupConfig] = useState(false);
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);

  // Group Workspace Drawer State
  const [drawerGroupId, setDrawerGroupId] = useState(null);
  const [drawerGroup, setDrawerGroup] = useState(null);
  const [drawerGroupTab, setDrawerGroupTab] = useState('overview'); // 'overview' | 'teams' | 'matches' | 'leaderboard' | 'chat'
  const [groupMatches, setGroupMatches] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [groupRoomForm, setGroupRoomForm] = useState({ roomId: '', roomPassword: '' });
  const [assignTeamId, setAssignTeamId] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [addMatchForm, setAddMatchForm] = useState({
    matchNumber: 1,
    name: 'Match 1',
    scheduledAt: '',
    checkInAt: '',
    lobbyOpenAt: '',
    roomId: '',
    roomPassword: '',
    instructions: '',
  });

  // Match Workspace Drawer State
  const [drawerMatchId, setDrawerMatchId] = useState(null);
  const [drawerMatch, setDrawerMatch] = useState(null);
  const [matchResults, setMatchResults] = useState([]);
  const [matchLeaderboard, setMatchLeaderboard] = useState([]);
  const [matchRoomForm, setMatchRoomForm] = useState({ roomId: '', roomPassword: '', instructions: '' });
  const [matchScheduleForm, setMatchScheduleForm] = useState({ scheduledAt: '', checkInAt: '', lobbyOpenAt: '' });
  const [scoreForm, setScoreForm] = useState({
    teamId: '',
    points: 0,
    kills: 0,
    placement: '',
    resultText: '',
    resultMedia: null,
  });

  // Quick Score Modal
  const [quickScoreModal, setQuickScoreModal] = useState({
    isOpen: false,
    matchId: null,
    matchName: '',
    teamId: '',
    points: 0,
    kills: 0,
    placement: 1,
    resultText: '',
  });

  // Deletion Confirmation Dialogs
  const [deleteConfirmRound, setDeleteConfirmRound] = useState(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState(null);

  // Feedback State
  const [state, setState] = useState({
    loading: true,
    actionLoading: false,
    error: '',
    notice: '',
  });

  // 1. Initial Load of Rounds
  const loadRounds = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const res = await fetchRounds(tournamentId);
      const list = res.rounds || [];
      setRounds(list);

      // Restore or select active round from query params
      const paramRoundId = Number(searchParams.get('round'));
      const found = list.find((r) => r.id === paramRoundId);
      const initialRoundId = found ? found.id : list[0]?.id || null;

      setSelectedRoundId(initialRoundId);
      setCreateRoundForm({ roundNumber: list.length + 1, name: `Round ${list.length + 1}` });

      const paramSection = searchParams.get('section');
      if (['overview', 'groups', 'qualifications'].includes(paramSection)) {
        setActiveSection(paramSection);
      }

      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState({ loading: false, actionLoading: false, error: err.message || 'Failed to load rounds.', notice: '' });
    }
  }, [tournamentId, searchParams]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  // 2. Load Selected Round Data (Groups, Stats, Eligible Teams, Qualifications)
  const loadSelectedRoundData = useCallback(async () => {
    if (!selectedRoundId) {
      setSelectedRound(null);
      setGroups([]);
      setEligibleTeams([]);
      setQualCenterData({ groups: [], qualifications: [] });
      return;
    }
    try {
      const [roundRes, groupsRes, eligibleRes, qualRes] = await Promise.allSettled([
        getRound(selectedRoundId),
        fetchGroups(selectedRoundId),
        fetchEligibleTeams(selectedRoundId),
        fetchQualificationCenter(selectedRoundId),
      ]);

      if (roundRes.status === 'fulfilled' && roundRes.value?.round) {
        setSelectedRound(roundRes.value.round);
      }
      if (groupsRes.status === 'fulfilled') {
        setGroups(groupsRes.value?.groups || []);
      }
      if (eligibleRes.status === 'fulfilled') {
        setEligibleTeams(eligibleRes.value?.teams || []);
      }
      if (qualRes.status === 'fulfilled') {
        setQualCenterData(qualRes.value || { groups: [], qualifications: [] });
      }
    } catch (err) {
      console.error('Error loading round data:', err);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    loadSelectedRoundData();
  }, [loadSelectedRoundData]);

  // Sync URL query params on state changes without pushing full page history
  const updateUrlParams = (newRoundId, newSection) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'rounds');
    if (newRoundId) {
      params.set('round', newRoundId);
    } else {
      params.delete('round');
    }
    if (newSection) params.set('section', newSection);
    setSearchParams(params, { replace: true });
  };

  const handleSelectRound = (roundId) => {
    setSelectedRoundId(roundId);
    updateUrlParams(roundId, activeSection);
  };

  const handleSelectSection = (section) => {
    setActiveSection(section);
    updateUrlParams(selectedRoundId, section);
  };

  // 3. Create Round
  const handleCreateRoundSubmit = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await createRound(tournamentId, {
        roundNumber: Number(createRoundForm.roundNumber),
        name: createRoundForm.name.trim(),
      });
      const created = result.round;
      setRounds((prev) => [...prev, created]);
      setSelectedRoundId(created.id);
      setShowCreateRoundModal(false);
      updateUrlParams(created.id, 'overview');
      setState({
        loading: false,
        actionLoading: false,
        notice: `Round ${created.roundNumber} created successfully.`,
        error: '',
      });
      loadSelectedRoundData();
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 4. Delete Round
  const handleDeleteRound = async () => {
    if (!deleteConfirmRound) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteRound(deleteConfirmRound.id);
      const remaining = rounds.filter((r) => r.id !== deleteConfirmRound.id);
      setRounds(remaining);
      const newActive = remaining[0]?.id || null;
      setSelectedRoundId(newActive);
      updateUrlParams(newActive, 'overview');
      const rName = deleteConfirmRound.name || `Round ${deleteConfirmRound.roundNumber}`;
      setDeleteConfirmRound(null);
      setState({
        loading: false,
        actionLoading: false,
        notice: `${rName} deleted successfully. Registered teams and players remain fully preserved.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 5. Start / Complete Round
  const handleStartRound = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateRound(selectedRoundId, { status: 'IN_PROGRESS' });
      setSelectedRound((prev) => ({ ...prev, ...res.round }));
      setRounds((prev) => prev.map((r) => (r.id === selectedRoundId ? { ...r, ...res.round } : r)));
      setState({ loading: false, actionLoading: false, notice: 'Round is now LIVE (IN_PROGRESS).', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleCompleteRound = async () => {
    if (!window.confirm('Complete this round? All group matches must be finished and qualifications verified.')) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await completeRound(selectedRoundId);
      setSelectedRound((prev) => ({ ...prev, ...res.round }));
      setRounds((prev) => prev.map((r) => (r.id === selectedRoundId ? { ...r, ...res.round } : r)));
      setState({ loading: false, actionLoading: false, notice: 'Round marked as COMPLETED.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 6. Add Custom Group
  const handleAddGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createGroup(selectedRoundId, {
        name: newGroupForm.name.trim(),
        groupSize: Number(newGroupForm.groupSize) || 12,
      });
      setGroups((prev) => [...prev, res.group]);
      setNewGroupForm({ name: '', groupSize: 12 });
      setShowAddGroupModal(false);
      setState({ loading: false, actionLoading: false, notice: `Created group ${res.group.name}.`, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 7. Delete Group
  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteGroup(deleteConfirmGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== deleteConfirmGroup.id));
      if (drawerGroupId === deleteConfirmGroup.id) {
        setDrawerGroupId(null);
        setDrawerGroup(null);
      }
      const gName = deleteConfirmGroup.name;
      setDeleteConfirmGroup(null);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Group "${gName}" deleted. Assigned teams remain preserved in the tournament pool.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 8. Group Configuration (Auto Assign, Bulk Move, Lock)
  const handleAutoAssign = async (config) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await autoAssignGroups(selectedRoundId, config);
      if (res.round) setSelectedRound(res.round);
      setGroups(res.groups || []);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Generated ${res.totalGroups} balanced groups for ${res.totalEligible} teams.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleBulkMove = async (payload) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await bulkMoveTeams(selectedRoundId, payload);
      setGroups(res.groups || []);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Moved ${payload.teamIds.length} teams.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleLockAssignment = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await lockRoundAssignment(selectedRoundId);
      if (res.round) setSelectedRound(res.round);
      setShowGroupConfig(false);
      setState({
        loading: false,
        actionLoading: false,
        notice: 'Group assignment is officially locked.',
        error: '',
      });
      loadSelectedRoundData();
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 9. Qualifications (Finalize, Reopen, Next Round)
  const handleFinalizeQualifications = async (payload) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await finalizeQualifications(selectedRoundId, payload);
      setQualCenterData((prev) => ({ ...prev, qualifications: res.qualifications || [] }));
      setSelectedRound((prev) => ({ ...prev, qualificationsFinalizedAt: new Date().toISOString() }));
      setState({
        loading: false,
        actionLoading: false,
        notice: `Finalized ${payload.selections.length} qualifying teams.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleReopenQualifications = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await reopenQualifications(selectedRoundId);
      setQualCenterData((prev) => ({ ...prev, qualifications: res.qualifications || [] }));
      setSelectedRound((prev) => ({ ...prev, qualificationsFinalizedAt: null }));
      setState({
        loading: false,
        actionLoading: false,
        notice: 'Qualifications reopened for editing.',
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleCreateNextRound = async (input) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createNextRound(tournamentId, input);
      setShowNextRoundModal(false);
      setRounds((prev) => [...prev, res.round]);
      setSelectedRoundId(res.round.id);
      setActiveSection('groups');
      updateUrlParams(res.round.id, 'groups');
      setState({
        loading: false,
        actionLoading: false,
        notice: `Round ${res.round.roundNumber} created.`,
        error: '',
      });
      loadSelectedRoundData();
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 10. Open Group Drawer & Load Group Details
  const handleOpenGroupDrawer = async (group) => {
    setDrawerGroupId(group.id);
    setDrawerGroup(group);
    setDrawerGroupTab('overview');
    setGroupRoomForm({ roomId: group.roomId || '', roomPassword: group.roomPassword || '' });

    try {
      const [grpRes, matchRes, leadRes] = await Promise.allSettled([
        fetchGroup(group.id),
        fetchGroupMatches(group.id),
        fetchGroupLeaderboard(group.id),
      ]);

      if (grpRes.status === 'fulfilled' && grpRes.value?.group) {
        setDrawerGroup(grpRes.value.group);
      }
      if (matchRes.status === 'fulfilled') {
        const list = matchRes.value?.matches || [];
        setGroupMatches(list);
        setAddMatchForm((prev) => ({ ...prev, matchNumber: list.length + 1, name: `Match ${list.length + 1}` }));
      }
      if (leadRes.status === 'fulfilled') {
        setGroupLeaderboard(leadRes.value?.leaderboard || []);
      }
    } catch (err) {
      console.error('Error loading group drawer data:', err);
    }
  };

  // Save Group Room
  const handleSaveGroupRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateGroup(drawerGroupId, groupRoomForm);
      setDrawerGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === drawerGroupId ? res.group : g)));
      setState({ loading: false, actionLoading: false, notice: 'Group room credentials saved and broadcasted.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Assign Team in Group Drawer
  const handleAssignTeamToGroup = async (e) => {
    e.preventDefault();
    if (!assignTeamId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await assignTeam(drawerGroupId, assignTeamId);
      setDrawerGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === drawerGroupId ? res.group : g)));
      setAssignTeamId('');
      setState({ loading: false, actionLoading: false, notice: 'Team assigned to group.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleRemoveTeamFromGroup = async (teamId) => {
    if (!window.confirm('Remove this team from group?')) return;
    try {
      const res = await removeGroupTeam(drawerGroupId, teamId);
      setDrawerGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === drawerGroupId ? res.group : g)));
      setState((s) => ({ ...s, notice: 'Team removed.' }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  // Add Match in Group Drawer
  const handleScheduleMatchInGroup = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const payload = {
        matchNumber: Number(addMatchForm.matchNumber),
        name: addMatchForm.name.trim(),
        scheduledAt: addMatchForm.scheduledAt || null,
        checkInAt: addMatchForm.checkInAt || null,
        lobbyOpenAt: addMatchForm.lobbyOpenAt || null,
        roomId: addMatchForm.roomId.trim() || null,
        roomPassword: addMatchForm.roomPassword.trim() || null,
        instructions: addMatchForm.instructions.trim() || null,
      };
      const res = await createMatch(drawerGroupId, payload);
      setGroupMatches((prev) => [...prev, res.match]);
      setAddMatchForm({
        matchNumber: groupMatches.length + 2,
        name: `Match ${groupMatches.length + 2}`,
        scheduledAt: '',
        checkInAt: '',
        lobbyOpenAt: '',
        roomId: '',
        roomPassword: '',
        instructions: '',
      });
      setShowAddMatchForm(false);
      setState({ loading: false, actionLoading: false, notice: 'Match scheduled.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // 11. Open Match Drawer & Manage Match
  const handleOpenMatchDrawer = async (match) => {
    setDrawerMatchId(match.id);
    setDrawerMatch(match);
    setMatchRoomForm({
      roomId: match.roomId || '',
      roomPassword: match.roomPassword || '',
      instructions: match.instructions || '',
    });
    setMatchScheduleForm({
      scheduledAt: match.scheduledAt ? match.scheduledAt.slice(0, 16) : '',
      checkInAt: match.checkInAt ? match.checkInAt.slice(0, 16) : '',
      lobbyOpenAt: match.lobbyOpenAt ? match.lobbyOpenAt.slice(0, 16) : '',
    });

    try {
      const [mRes, resRes, lbRes] = await Promise.allSettled([
        fetchMatch(match.id),
        fetchResults(match.id),
        fetchMatchLeaderboard(match.id),
      ]);

      if (mRes.status === 'fulfilled' && mRes.value?.match) {
        setDrawerMatch(mRes.value.match);
      }
      if (resRes.status === 'fulfilled') {
        setMatchResults(resRes.value?.results || []);
      }
      if (lbRes.status === 'fulfilled') {
        setMatchLeaderboard(lbRes.value?.leaderboard || []);
      }
    } catch (err) {
      console.error('Error loading match details:', err);
    }
  };

  // Save Match Room
  const handleSaveMatchRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateMatch(drawerMatchId, {
        roomId: matchRoomForm.roomId.trim() || null,
        roomPassword: matchRoomForm.roomPassword.trim() || null,
        instructions: matchRoomForm.instructions.trim() || null,
      });
      setDrawerMatch(res.match);
      setGroupMatches((prev) => prev.map((m) => (m.id === drawerMatchId ? res.match : m)));
      setState({ loading: false, actionLoading: false, notice: 'Match room credentials saved.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Save Match Schedule
  const handleSaveMatchSchedule = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateMatch(drawerMatchId, {
        scheduledAt: matchScheduleForm.scheduledAt || null,
        checkInAt: matchScheduleForm.checkInAt || null,
        lobbyOpenAt: matchScheduleForm.lobbyOpenAt || null,
      });
      setDrawerMatch(res.match);
      setGroupMatches((prev) => prev.map((m) => (m.id === drawerMatchId ? res.match : m)));
      setState({ loading: false, actionLoading: false, notice: 'Match timing schedule updated.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Notify Match Details
  const handleNotifyMatchPlayers = async (matchId) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await notifyMatchSchedule(matchId);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Match details broadcasted to ${res.recipientsCount || 'all group'} players.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Delete Match
  const handleDeleteMatch = async () => {
    if (!deleteConfirmMatch) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteMatch(deleteConfirmMatch.id);
      setGroupMatches((prev) => prev.filter((m) => m.id !== deleteConfirmMatch.id));
      if (drawerMatchId === deleteConfirmMatch.id) {
        setDrawerMatchId(null);
        setDrawerMatch(null);
      }
      const mName = deleteConfirmMatch.name;
      setDeleteConfirmMatch(null);
      setState({ loading: false, actionLoading: false, notice: `Match "${mName}" deleted.`, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Submit Score in Match Drawer
  const handleMatchScoreSubmit = async (e) => {
    e.preventDefault();
    if (!scoreForm.teamId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createResult(drawerMatchId, scoreForm);
      setMatchResults((prev) => [...prev, res.result]);
      setScoreForm({ teamId: '', points: 0, kills: 0, placement: '', resultText: '', resultMedia: null });

      const lbRes = await recalculateLeaderboard(drawerMatchId);
      setMatchLeaderboard(lbRes.leaderboard || []);

      setState({
        loading: false,
        actionLoading: false,
        notice: `Result recorded for ${res.result.teamName}. Leaderboard recalculated.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Quick Score Modal Submit
  const handleQuickScoreSubmit = async (e) => {
    e.preventDefault();
    if (!quickScoreModal.teamId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await createResult(quickScoreModal.matchId, {
        teamId: quickScoreModal.teamId,
        points: Number(quickScoreModal.points),
        kills: Number(quickScoreModal.kills),
        placement: Number(quickScoreModal.placement),
        resultText: quickScoreModal.resultText,
      });
      await recalculateLeaderboard(quickScoreModal.matchId);
      if (drawerGroupId) {
        const leadRes = await fetchGroupLeaderboard(drawerGroupId);
        setGroupLeaderboard(leadRes.leaderboard || []);
      }
      setQuickScoreModal({ isOpen: false, matchId: null, matchName: '', teamId: '', points: 0, kills: 0, placement: 1, resultText: '' });
      setState({ loading: false, actionLoading: false, notice: 'Score submitted and leaderboard updated.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const isCompletedTournament = tournamentStatus === 'COMPLETED';
  const isLocked = selectedRound?.isLocked || selectedRound?.assignmentStatus === 'LOCKED';

  // Metrics
  const stats = selectedRound?.stats || {
    totalGroups: groups.length,
    completedGroups: groups.filter((g) => g.status === 'COMPLETED').length,
    totalTeams: groups.reduce((acc, g) => acc + (g.teams?.length || 0), 0),
    totalMatches: groups.reduce((acc, g) => acc + (g.matches?.length || 0), 0),
    completedMatches: groups.reduce((acc, g) => acc + (g.matches?.filter((m) => m.status === 'COMPLETED').length || 0), 0),
    liveMatches: groups.reduce((acc, g) => acc + (g.matches?.filter((m) => m.status === 'LIVE').length || 0), 0),
    qualifiedTeams: qualCenterData.qualifications?.length || 0,
  };

  const matchPercent = stats.totalMatches > 0 ? Math.round((stats.completedMatches / stats.totalMatches) * 100) : 0;
  const groupPercent = stats.totalGroups > 0 ? Math.round((stats.completedGroups / stats.totalGroups) * 100) : 0;

  return (
    <div className="organizer-rounds-hub">
      {/* Alert Notices */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '16px' }}>{state.notice}</div>}

      {/* 1. TOP ROUND SELECTOR BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#7dd3fc', textTransform: 'uppercase', marginRight: '6px' }}>
            Rounds:
          </span>
          {rounds.map((r) => {
            const isSelected = r.id === selectedRoundId;
            return (
              <button
                key={r.id}
                type="button"
                className={`button ${isSelected ? 'primary-button' : 'ghost-button'}`}
                style={{ minHeight: '34px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleSelectRound(r.id)}
              >
                <span>{r.name || `Round ${r.roundNumber}`}</span>
                <span className={`status-badge ${r.status.toLowerCase().replaceAll('_', '-')}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                  {r.status.replaceAll('_', ' ')}
                </span>
              </button>
            );
          })}
        </div>

        <div>
          {!isCompletedTournament && (
            <button
              className="button secondary-button"
              style={{ minHeight: '34px', padding: '0 12px', fontSize: '13px' }}
              type="button"
              onClick={() => setShowCreateRoundModal(true)}
            >
              + Create Round
            </button>
          )}
        </div>
      </div>

      {/* If No Rounds Exist */}
      {rounds.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>No rounds created yet</h3>
          <p style={{ color: '#91a0b3', marginBottom: '20px' }}>
            Create Round 1 to initialize the competition group stage.
          </p>
          <button
            className="button primary-button"
            type="button"
            onClick={() => setShowCreateRoundModal(true)}
          >
            + Create Round 1
          </button>
        </div>
      ) : selectedRound ? (
        <div>
          {/* 2. SELECTED ROUND HEADER & SUMMARY METRICS */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
            border: '1px solid rgba(125, 211, 252, 0.2)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span className={`status-badge ${selectedRound.status.toLowerCase().replaceAll('_', '-')}`}>
                    {selectedRound.status.replaceAll('_', ' ')}
                  </span>
                  <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                    Stage: {selectedRound.assignmentStatus || 'DRAFT'} {selectedRound.isLocked ? '(LOCKED)' : ''}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>
                  {selectedRound.name || `Round ${selectedRound.roundNumber}`} Control Center
                </h2>
              </div>

              {/* Lifecycle Actions & Delete Round */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {selectedRound.status === 'NOT_STARTED' && !isCompletedTournament && (
                  <button
                    className="button primary-button"
                    type="button"
                    onClick={handleStartRound}
                    disabled={state.actionLoading}
                  >
                    Start Round (LIVE)
                  </button>
                )}
                {selectedRound.status === 'IN_PROGRESS' && !isCompletedTournament && (
                  <button
                    className="button secondary-button"
                    style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }}
                    type="button"
                    onClick={handleCompleteRound}
                    disabled={state.actionLoading}
                  >
                    Complete Round
                  </button>
                )}
                {!isCompletedTournament && (
                  <button
                    className="button ghost-button danger-text"
                    type="button"
                    onClick={() => setDeleteConfirmRound(selectedRound)}
                    disabled={state.actionLoading}
                  >
                    Delete Round
                  </button>
                )}
              </div>
            </div>

            {/* Operational Metric Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginTop: '20px',
            }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase' }}>Groups</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                  {stats.completedGroups} / {stats.totalGroups}
                </div>
                <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${groupPercent}%`, background: '#f6c453', height: '100%' }} />
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase' }}>Assigned Teams</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7dd3fc', marginTop: '4px' }}>
                  {stats.totalTeams}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase' }}>Matches</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                  {stats.completedMatches} / {stats.totalMatches}
                  {stats.liveMatches > 0 && <span style={{ fontSize: '12px', color: '#2ecc71', marginLeft: '6px' }}>({stats.liveMatches} LIVE)</span>}
                </div>
                <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${matchPercent}%`, background: '#7dd3fc', height: '100%' }} />
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase' }}>Qualified Teams</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: stats.qualifiedTeams > 0 ? '#2ecc71' : '#f6c453', marginTop: '4px' }}>
                  {stats.qualifiedTeams}
                </div>
              </div>
            </div>
          </div>

          {/* 3. INTERNAL ROUND SECTION TABS (Overview | Groups | Qualifications) */}
          <nav className="hub-tabs" aria-label="Round internal sections" role="tablist" style={{ marginBottom: '20px' }}>
            <button
              role="tab"
              aria-selected={activeSection === 'overview'}
              className={activeSection === 'overview' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('overview')}
            >
              Overview
            </button>
            <button
              role="tab"
              aria-selected={activeSection === 'groups'}
              className={activeSection === 'groups' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('groups')}
            >
              Groups ({groups.length})
            </button>
            <button
              role="tab"
              aria-selected={activeSection === 'qualifications'}
              className={activeSection === 'qualifications' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('qualifications')}
            >
              Qualifications ({qualCenterData.qualifications?.length || 0})
            </button>
          </nav>

          {/* ========================================================================= */}
          {/* SECTION 1: ROUND OVERVIEW */}
          {/* ========================================================================= */}
          {activeSection === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {groups.map((group) => {
                  const teamCount = group.teams?.length || 0;
                  const matchCount = group.matches?.length || 0;
                  const completedCount = group.matches?.filter((m) => m.status === 'COMPLETED').length || 0;
                  const liveMatch = group.matches?.find((m) => m.status === 'LIVE');

                  return (
                    <div
                      key={group.id}
                      style={{
                        background: 'rgba(28, 33, 40, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{group.name}</h4>
                          <span className={`status-badge ${group.status.toLowerCase().replaceAll('_', '-')}`}>
                            {group.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#91a0b3', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>{teamCount} / {group.groupSize || 12} Teams Assigned</div>
                          <div>{completedCount} / {matchCount} Matches Finished</div>
                          <div style={{ color: group.roomId ? '#2ecc71' : '#f6c453' }}>
                            Room: {group.roomId ? 'Configured' : 'Awaiting Room ID'}
                          </div>
                          {liveMatch && (
                            <div style={{ color: '#2ecc71', fontWeight: 'bold' }}>
                              Active: {liveMatch.name} (LIVE)
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                          className="button primary-button"
                          style={{ width: '100%', minHeight: '32px', fontSize: '12px' }}
                          type="button"
                          onClick={() => handleOpenGroupDrawer(group)}
                        >
                          Manage Group Workspace →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: GROUPS (MAIN OPERATIONAL AREA) */}
          {/* ========================================================================= */}
          {activeSection === 'groups' && (
            <div>
              {/* Groups Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Group Stages</h3>
                  <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                    {isLocked ? 'Assignments are locked.' : 'Drafting stage: configure balanced rosters or adjust teams.'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {!isCompletedTournament && (
                    <>
                      <button
                        className="button secondary-button"
                        type="button"
                        onClick={() => setShowGroupConfig(true)}
                      >
                        Configure Groups (Snake Seeding)
                      </button>
                      <button
                        className="button ghost-button"
                        type="button"
                        onClick={() => setShowAddGroupModal(true)}
                      >
                        + Add Group
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Group Cards Grid */}
              {groups.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>No groups generated yet</h3>
                  <p style={{ color: '#91a0b3', marginBottom: '16px' }}>
                    Eligible verified teams for this round: <strong>{eligibleTeams.length}</strong>
                  </p>
                  <button
                    className="button primary-button"
                    type="button"
                    onClick={() => setShowGroupConfig(true)}
                  >
                    Configure Groups
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {groups.map((group) => {
                    const teamCount = group.teams?.length || 0;
                    const matchCount = group.matches?.length || 0;
                    const completedCount = group.matches?.filter((m) => m.status === 'COMPLETED').length || 0;

                    return (
                      <div
                        key={group.id}
                        style={{
                          background: 'rgba(28, 33, 40, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '14px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{group.name}</h4>
                              <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                                {teamCount} / {group.groupSize || 12} Teams
                              </span>
                            </div>
                            <span className={`status-badge ${group.status.toLowerCase().replaceAll('_', '-')}`}>
                              {group.status}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#cdd6e2', marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#91a0b3' }}>Matches:</span>
                              <strong>{completedCount} / {matchCount} Completed</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#91a0b3' }}>Room:</span>
                              <span style={{ color: group.roomId ? '#2ecc71' : '#f6c453' }}>
                                {group.roomId ? 'Configured' : 'Not Set'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                          <button
                            className="button primary-button"
                            style={{ flex: 1, minHeight: '32px', fontSize: '12px' }}
                            type="button"
                            onClick={() => handleOpenGroupDrawer(group)}
                          >
                            Manage Group
                          </button>
                          {!isCompletedTournament && (
                            <button
                              className="button ghost-button danger-text"
                              style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                              type="button"
                              onClick={() => setDeleteConfirmGroup(group)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: QUALIFICATIONS (INLINE CENTER) */}
          {/* ========================================================================= */}
          {activeSection === 'qualifications' && (
            <div>
              <QualificationCenterView
                tournamentId={tournamentId}
                round={selectedRound}
                groups={qualCenterData.groups || []}
                qualifications={qualCenterData.qualifications || []}
                isSubmitting={state.actionLoading}
                onFinalize={handleFinalizeQualifications}
                onReopen={handleReopenQualifications}
                onCreateNextRound={() => setShowNextRoundModal(true)}
              />

              <NextRoundModal
                tournamentId={tournamentId}
                currentRoundNumber={selectedRound.roundNumber || 1}
                qualifiedTeams={qualCenterData.qualifications || []}
                isCreating={state.actionLoading}
                isOpen={showNextRoundModal}
                onClose={() => setShowNextRoundModal(false)}
                onSubmit={handleCreateNextRound}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* GROUP DETAIL DRAWER (INSIDE TOURNAMENT HUB) */}
      {/* ========================================================================= */}
      {drawerGroupId && drawerGroup && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerGroupId(null);
          }}
        >
          <div
            style={{
              width: 'min(640px, 100%)',
              height: '100%',
              background: '#161b22',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className={`status-badge ${drawerGroup.status.toLowerCase().replaceAll('_', '-')}`}>
                    {drawerGroup.status}
                  </span>
                  <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                    {drawerGroup.teams?.length || 0} / {drawerGroup.groupSize || 12} Teams
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>{drawerGroup.name} Workspace</h3>
              </div>

              <button
                className="button ghost-button"
                type="button"
                style={{ fontSize: '18px', padding: '4px 10px', minHeight: '32px' }}
                onClick={() => setDrawerGroupId(null)}
              >
                ✕
              </button>
            </div>

            {/* Drawer Internal Navigation */}
            <nav className="hub-tabs" role="tablist" style={{ marginBottom: '10px' }}>
              <button
                role="tab"
                aria-selected={drawerGroupTab === 'overview'}
                className={drawerGroupTab === 'overview' ? 'hub-tab active' : 'hub-tab'}
                onClick={() => setDrawerGroupTab('overview')}
              >
                Room & Info
              </button>
              <button
                role="tab"
                aria-selected={drawerGroupTab === 'teams'}
                className={drawerGroupTab === 'teams' ? 'hub-tab active' : 'hub-tab'}
                onClick={() => setDrawerGroupTab('teams')}
              >
                Teams ({drawerGroup.teams?.length || 0})
              </button>
              <button
                role="tab"
                aria-selected={drawerGroupTab === 'matches'}
                className={drawerGroupTab === 'matches' ? 'hub-tab active' : 'hub-tab'}
                onClick={() => setDrawerGroupTab('matches')}
              >
                Matches ({groupMatches.length})
              </button>
              <button
                role="tab"
                aria-selected={drawerGroupTab === 'leaderboard'}
                className={drawerGroupTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'}
                onClick={() => setDrawerGroupTab('leaderboard')}
              >
                Leaderboard
              </button>
              <button
                role="tab"
                aria-selected={drawerGroupTab === 'chat'}
                className={drawerGroupTab === 'chat' ? 'hub-tab active' : 'hub-tab'}
                onClick={() => setDrawerGroupTab('chat')}
              >
                Chat
              </button>
            </nav>

            {/* Drawer Tab 1: Room & Overview */}
            {drawerGroupTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <form onSubmit={handleSaveGroupRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#7dd3fc', fontSize: '15px' }}>Group Room Credentials</h4>
                  
                  <label htmlFor="drawer-group-room-id" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>In-Game Room ID</label>
                  <input
                    id="drawer-group-room-id"
                    style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '12px' }}
                    value={groupRoomForm.roomId}
                    onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomId: e.target.value })}
                    placeholder="e.g. 5839201"
                  />

                  <label htmlFor="drawer-group-room-pw" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Room Password</label>
                  <input
                    id="drawer-group-room-pw"
                    style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '16px' }}
                    value={groupRoomForm.roomPassword}
                    onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomPassword: e.target.value })}
                    placeholder="e.g. evo123"
                  />

                  <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                    Save Group Room
                  </button>
                </form>

                {/* Group Danger Zone */}
                {drawerGroup.status !== 'COMPLETED' && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 6px 0', color: '#ef4444', fontSize: '14px' }}>Delete Group</h4>
                    <p style={{ color: '#91a0b3', fontSize: '12px', marginBottom: '12px' }}>
                      Removes group assignments and empty matches. Registered teams remain in the tournament.
                    </p>
                    <button
                      className="button danger-button"
                      type="button"
                      style={{ minHeight: '32px', fontSize: '12px' }}
                      onClick={() => setDeleteConfirmGroup(drawerGroup)}
                    >
                      Delete This Group
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Drawer Tab 2: Teams */}
            {drawerGroupTab === 'teams' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <form onSubmit={handleAssignTeamToGroup} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    style={{ flex: 1, minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                    value={assignTeamId}
                    onChange={(e) => setAssignTeamId(e.target.value)}
                  >
                    <option value="">Select verified team...</option>
                    {eligibleTeams
                      .filter((t) => !drawerGroup.teams?.some((gt) => gt.id === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                  <button className="button primary-button" type="submit" disabled={!assignTeamId || state.actionLoading}>
                    + Assign
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {drawerGroup.teams?.length === 0 ? (
                    <p className="empty-state">No teams assigned yet.</p>
                  ) : (
                    drawerGroup.teams.map((team) => (
                      <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <strong style={{ color: '#fff', fontSize: '14px' }}>{team.name}</strong>
                        {!isLocked && (
                          <button className="text-button danger-text" type="button" onClick={() => handleRemoveTeamFromGroup(team.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Drawer Tab 3: Matches */}
            {drawerGroupTab === 'matches' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Scheduled Matches</h4>
                  <button
                    className="button secondary-button"
                    type="button"
                    style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => setShowAddMatchForm((v) => !v)}
                  >
                    {showAddMatchForm ? 'Hide Form' : '+ Add Match'}
                  </button>
                </div>

                {showAddMatchForm && (
                  <form onSubmit={handleScheduleMatchInGroup} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(125,211,252,0.2)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                      <input
                        type="number"
                        min="1"
                        style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                        value={addMatchForm.matchNumber}
                        onChange={(e) => setAddMatchForm({ ...addMatchForm, matchNumber: e.target.value, name: `Match ${e.target.value}` })}
                        placeholder="Match #"
                        required
                      />
                      <input
                        style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                        value={addMatchForm.name}
                        onChange={(e) => setAddMatchForm({ ...addMatchForm, name: e.target.value })}
                        placeholder="Match Name"
                        required
                      />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <input
                        type="datetime-local"
                        style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                        value={addMatchForm.scheduledAt}
                        onChange={(e) => setAddMatchForm({ ...addMatchForm, scheduledAt: e.target.value })}
                      />
                    </div>
                    <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                      Schedule Match
                    </button>
                  </form>
                )}

                {/* Group Matches Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groupMatches.map((m) => (
                    <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div>
                          <strong style={{ color: '#7dd3fc', fontSize: '13px' }}>#{m.matchNumber}</strong>
                          <span style={{ color: '#fff', fontWeight: 'bold', marginLeft: '6px' }}>{m.name}</span>
                        </div>
                        <span className={`status-badge ${m.status.toLowerCase().replaceAll('_', '-')}`} style={{ fontSize: '10px' }}>
                          {m.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#91a0b3', marginBottom: '10px' }}>
                        {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'No schedule set'}
                        {m.roomId ? ` · Room: ${m.roomId}` : ''}
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className="button primary-button"
                          style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                          type="button"
                          onClick={() => handleOpenMatchDrawer(m)}
                        >
                          Manage Match
                        </button>
                        <button
                          className="button ghost-button"
                          style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                          type="button"
                          onClick={() => handleNotifyMatchPlayers(m.id)}
                        >
                          Notify Teams
                        </button>
                        <button
                          className="button ghost-button"
                          style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                          type="button"
                          onClick={() => setQuickScoreModal({ isOpen: true, matchId: m.id, matchName: m.name, teamId: drawerGroup.teams?.[0]?.id || '', points: 0, kills: 0, placement: 1, resultText: '' })}
                        >
                          + Score
                        </button>
                        <button
                          className="button ghost-button danger-text"
                          style={{ minHeight: '28px', padding: '0 6px', fontSize: '11px' }}
                          type="button"
                          onClick={() => setDeleteConfirmMatch(m)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drawer Tab 4: Leaderboard */}
            {drawerGroupTab === 'leaderboard' && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Rank</th>
                      <th style={{ padding: '8px' }}>Team</th>
                      <th style={{ padding: '8px' }}>Kills</th>
                      <th style={{ padding: '8px' }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupLeaderboard.map((r, i) => (
                      <tr key={r.teamId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px', color: '#fff', fontWeight: 'bold' }}>#{r.rank || i + 1}</td>
                        <td style={{ padding: '8px', color: '#fff' }}>{r.teamName}</td>
                        <td style={{ padding: '8px', color: '#91a0b3' }}>{r.kills}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#7dd3fc' }}>{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Drawer Tab 5: Chat */}
            {drawerGroupTab === 'chat' && (
              <GroupChatView groupId={drawerGroup.id} groupName={drawerGroup.name} isCompleted={drawerGroup.status === 'COMPLETED'} />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MATCH DETAIL DRAWER (INSIDE TOURNAMENT HUB) */}
      {/* ========================================================================= */}
      {drawerMatchId && drawerMatch && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerMatchId(null);
          }}
        >
          <div
            style={{
              width: 'min(640px, 100%)',
              height: '100%',
              background: '#161b22',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className={`status-badge ${drawerMatch.status.toLowerCase().replaceAll('_', '-')}`}>
                    {drawerMatch.status}
                  </span>
                  <span style={{ fontSize: '13px', color: '#7dd3fc' }}>Match #{drawerMatch.matchNumber}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{drawerMatch.name}</h3>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="button ghost-button"
                  type="button"
                  style={{ fontSize: '18px', padding: '4px 10px', minHeight: '32px' }}
                  onClick={() => setDrawerMatchId(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Match Room & Schedule Forms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              <form onSubmit={handleSaveMatchRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Room Credentials</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input
                    style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                    value={matchRoomForm.roomId}
                    onChange={(e) => setMatchRoomForm({ ...matchRoomForm, roomId: e.target.value })}
                    placeholder="Room ID"
                  />
                  <input
                    style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                    value={matchRoomForm.roomPassword}
                    onChange={(e) => setMatchRoomForm({ ...matchRoomForm, roomPassword: e.target.value })}
                    placeholder="Password"
                  />
                </div>
                <input
                  style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '10px' }}
                  value={matchRoomForm.instructions}
                  onChange={(e) => setMatchRoomForm({ ...matchRoomForm, instructions: e.target.value })}
                  placeholder="Optional Room Instructions"
                />
                <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                  Save Room
                </button>
              </form>

              <form onSubmit={handleSaveMatchSchedule} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Match Schedule</h4>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '4px' }}>Start Time</label>
                  <input
                    type="datetime-local"
                    style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                    value={matchScheduleForm.scheduledAt}
                    onChange={(e) => setMatchScheduleForm({ ...matchScheduleForm, scheduledAt: e.target.value })}
                  />
                </div>
                <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                  Save Schedule
                </button>
              </form>
            </div>

            {/* Score Entry Form */}
            <form onSubmit={handleMatchScoreSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '14px' }}>Record Team Score</h4>
              <select
                style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '10px' }}
                value={scoreForm.teamId}
                onChange={(e) => setScoreForm({ ...scoreForm, teamId: e.target.value })}
                required
              >
                <option value="">Select team...</option>
                {drawerGroup?.teams?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="number"
                  min="1"
                  style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={scoreForm.placement}
                  onChange={(e) => setScoreForm({ ...scoreForm, placement: e.target.value })}
                  placeholder="Place"
                />
                <input
                  type="number"
                  min="0"
                  style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={scoreForm.kills}
                  onChange={(e) => setScoreForm({ ...scoreForm, kills: e.target.value })}
                  placeholder="Kills"
                  required
                />
                <input
                  type="number"
                  min="0"
                  style={{ minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={scoreForm.points}
                  onChange={(e) => setScoreForm({ ...scoreForm, points: e.target.value })}
                  placeholder="Points"
                  required
                />
              </div>

              <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                Save Result
              </button>
            </form>

            {/* Results Recorded */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '14px' }}>Results ({matchResults.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {matchResults.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#fff' }}>#{r.placement || '-'} {r.teamName}</span>
                    <strong style={{ color: '#7dd3fc' }}>{r.points} pts · {r.kills} kills</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP CONFIGURATION DRAWER / MODAL (INLINE WORKSPACE) */}
      {/* ========================================================================= */}
      {showGroupConfig && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: 'min(900px, 100%)',
              maxHeight: '90vh',
              background: '#161b22',
              border: '1px solid rgba(125,211,252,0.2)',
              borderRadius: '10px',
              padding: '24px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>
                  {selectedRound.name || `Round ${selectedRound.roundNumber}`} — Group Configuration
                </h3>
                <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                  Eligible Verified Teams: <strong>{eligibleTeams.length}</strong>
                </span>
              </div>

              <button
                className="button ghost-button"
                type="button"
                style={{ fontSize: '18px', padding: '4px 10px', minHeight: '32px' }}
                onClick={() => setShowGroupConfig(false)}
              >
                ✕
              </button>
            </div>

            {/* Setup Wizard */}
            {(!isLocked || groups.length === 0) && (
              <RoundSetupWizard
                roundNumber={selectedRound.roundNumber || 1}
                eligibleTeamsCount={eligibleTeams.length}
                isGenerating={state.actionLoading}
                isLocked={isLocked}
                onGenerate={handleAutoAssign}
              />
            )}

            {/* Assignment Workspace */}
            {groups.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <AssignmentWorkspace
                  tournamentId={tournamentId}
                  round={selectedRound}
                  groups={groups}
                  eligibleTeams={eligibleTeams}
                  isActionLoading={state.actionLoading}
                  onBulkMove={handleBulkMove}
                  onLockAssignment={handleLockAssignment}
                  onRegenerate={() =>
                    handleAutoAssign({
                      mode: 'BY_SIZE',
                      targetGroupSize: groups[0]?.groupSize || 12,
                    })
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE ROUND MODAL */}
      {/* ========================================================================= */}
      {showCreateRoundModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <form onSubmit={handleCreateRoundSubmit} style={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', width: 'min(420px, 100%)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Create Competition Round</h3>

            <label htmlFor="cr-round-num" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Round Number</label>
            <input
              id="cr-round-num"
              type="number"
              min="1"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '14px' }}
              value={createRoundForm.roundNumber}
              onChange={(e) => setCreateRoundForm({ ...createRoundForm, roundNumber: e.target.value, name: `Round ${e.target.value}` })}
              required
            />

            <label htmlFor="cr-round-name" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Round Name</label>
            <input
              id="cr-round-name"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '20px' }}
              value={createRoundForm.name}
              onChange={(e) => setCreateRoundForm({ ...createRoundForm, name: e.target.value })}
              placeholder="e.g. Round 1, Semi-Finals, Finals"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setShowCreateRoundModal(false)}
              >
                Cancel
              </button>
              <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                Create Round
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODALS */}
      {/* ========================================================================= */}
      {deleteConfirmRound && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(460px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Round</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmRound.name || `Round ${deleteConfirmRound.roundNumber}`}</strong>?
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#fca5a5', marginBottom: '20px' }}>
              <strong>Safety Protection:</strong> Deleting a round removes its draft group configurations and unplayed matches. The underlying registered teams and players remain fully preserved in the tournament pool. Rounds with recorded match results or finalized qualifications cannot be deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setDeleteConfirmRound(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteRound}
                disabled={state.actionLoading}
              >
                Confirm Delete Round
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD GROUP MODAL */}
      {showAddGroupModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <form onSubmit={handleAddGroupSubmit} style={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', width: 'min(420px, 100%)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Add Custom Group</h3>

            <label htmlFor="ag-group-name" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Group Name</label>
            <input
              id="ag-group-name"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '14px' }}
              value={newGroupForm.name}
              onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
              placeholder="e.g. Group C"
              required
            />

            <label htmlFor="ag-group-size" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Capacity (Teams)</label>
            <input
              id="ag-group-size"
              type="number"
              min="2"
              max="64"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '20px' }}
              value={newGroupForm.groupSize}
              onChange={(e) => setNewGroupForm({ ...newGroupForm, groupSize: e.target.value })}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setShowAddGroupModal(false)}
              >
                Cancel
              </button>
              <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                Add Group
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK SCORE MODAL */}
      {quickScoreModal.isOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <form onSubmit={handleQuickScoreSubmit} style={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', width: 'min(450px, 100%)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Record Score ({quickScoreModal.matchName})</h3>

            <label htmlFor="qs-team" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Team</label>
            <select
              id="qs-team"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '12px' }}
              value={quickScoreModal.teamId}
              onChange={(e) => setQuickScoreModal({ ...quickScoreModal, teamId: e.target.value })}
              required
            >
              <option value="">Select team...</option>
              {drawerGroup?.teams?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="qs-place" style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '4px' }}>Place</label>
                <input
                  id="qs-place"
                  type="number"
                  min="1"
                  style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={quickScoreModal.placement}
                  onChange={(e) => setQuickScoreModal({ ...quickScoreModal, placement: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="qs-kills" style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '4px' }}>Kills</label>
                <input
                  id="qs-kills"
                  type="number"
                  min="0"
                  style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={quickScoreModal.kills}
                  onChange={(e) => setQuickScoreModal({ ...quickScoreModal, kills: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="qs-points" style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '4px' }}>Points</label>
                <input
                  id="qs-points"
                  type="number"
                  min="0"
                  style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                  value={quickScoreModal.points}
                  onChange={(e) => setQuickScoreModal({ ...quickScoreModal, points: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setQuickScoreModal({ ...quickScoreModal, isOpen: false })}
              >
                Cancel
              </button>
              <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                Save Score
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE GROUP MODAL */}
      {deleteConfirmGroup && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(450px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Group</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmGroup.name}</strong>?
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#fca5a5', marginBottom: '20px' }}>
              <strong>Safety Protection:</strong> Deleting a group unassigns teams back to the tournament pool and deletes scheduled matches without results. The underlying registered teams and players remain fully preserved.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteGroup}
                disabled={state.actionLoading}
              >
                Confirm Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MATCH MODAL */}
      {deleteConfirmMatch && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(420px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Match</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmMatch.name}</strong>?
            </p>
            <p style={{ color: '#91a0b3', fontSize: '13px', marginBottom: '20px' }}>
              Matches with recorded scores cannot be deleted.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setDeleteConfirmMatch(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteMatch}
                disabled={state.actionLoading}
              >
                Confirm Delete Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
