import { useCallback, useEffect, useRef, useState } from 'react';
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
import { fetchScoringConfig } from '../../services/tournamentApi.js';
import { RoundSetupWizard } from './RoundSetupWizard.jsx';
import { AssignmentWorkspace } from './AssignmentWorkspace.jsx';
import { QualificationCenterView } from './QualificationCenterView.jsx';
import { NextRoundModal } from './NextRoundModal.jsx';
import { GroupChatView } from '../GroupChatView.jsx';

export function OrganizerRoundsHub({ tournamentId, tournamentStatus }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Section Refs for Direct Auto-Scroll
  const overviewRef = useRef(null);
  const roomRef = useRef(null);
  const matchesRef = useRef(null);
  const leaderboardRef = useRef(null);
  const teamsRef = useRef(null);
  const chatRef = useRef(null);

  const sectionRefs = {
    overview: overviewRef,
    room: roomRef,
    matches: matchesRef,
    leaderboard: leaderboardRef,
    teams: teamsRef,
    chat: chatRef,
  };

  // Navigation State
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'groups' | 'qualifications'

  // Selected Round Data
  const [selectedRound, setSelectedRound] = useState(null);
  const [groups, setGroups] = useState([]);
  const [eligibleTeams, setEligibleTeams] = useState([]);
  const [qualCenterData, setQualCenterData] = useState({ groups: [], qualifications: [] });
  const [scoringMode, setScoringMode] = useState('KILLS_AND_POSITION');

  // Modals & Wizards
  const [showCreateRoundModal, setShowCreateRoundModal] = useState(false);
  const [createRoundForm, setCreateRoundForm] = useState({ roundNumber: 1, name: 'Round 1' });

  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', groupSize: 12 });

  const [showGroupConfig, setShowGroupConfig] = useState(false);
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);

  // Inline Group Workspace State (Replaces Right Drawer)
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupTab, setSelectedGroupTab] = useState('overview'); // 'overview' | 'room' | 'matches' | 'leaderboard' | 'teams' | 'chat'
  const [groupMatches, setGroupMatches] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [groupRoomForm, setGroupRoomForm] = useState({ roomId: '', roomPassword: '', instructions: '' });
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

  // Inline Match Workspace State (Inside Group Matches tab)
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
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

  // Copy Feedback State
  const [copiedField, setCopiedField] = useState(null);

  // Feedback State
  const [state, setState] = useState({
    loading: true,
    actionLoading: false,
    error: '',
    notice: '',
  });

  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // Sync URL query params with current navigation state (without triggering reload)
  const updateUrlParams = ({
    newRoundId = selectedRoundId,
    newSection = activeSection,
    newGroupId = selectedGroupId,
    newGroupTab = selectedGroupTab,
    newMatchId = selectedMatchId,
  } = {}) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'rounds');
    if (newRoundId) {
      params.set('round', newRoundId);
    } else {
      params.delete('round');
    }

    if (newSection) {
      params.set('section', newSection);
    } else {
      params.delete('section');
    }

    if (newGroupId) {
      params.set('group', newGroupId);
      if (newGroupTab) {
        params.set('groupTab', newGroupTab);
      } else {
        params.delete('groupTab');
      }
      if (newMatchId) {
        params.set('match', newMatchId);
      } else {
        params.delete('match');
      }
    } else {
      params.delete('group');
      params.delete('groupTab');
      params.delete('match');
    }
    setSearchParams(params, { replace: true });
  };

  // 1. Initial Load of Rounds
  const loadRounds = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const [roundsRes, scoringRes] = await Promise.allSettled([
        fetchRounds(tournamentId),
        fetchScoringConfig(tournamentId),
      ]);

      const list = roundsRes.status === 'fulfilled' ? roundsRes.value?.rounds || [] : [];
      setRounds(list);

      if (scoringRes.status === 'fulfilled' && scoringRes.value?.scoringConfig) {
        setScoringMode(scoringRes.value.scoringConfig.scoringMode || 'KILLS_AND_POSITION');
      }

      // Restore or select active round from query params
      const initialSearchParams = new URLSearchParams(window.location.search);
      const paramRoundId = Number(initialSearchParams.get('round'));
      const found = list.find((r) => r.id === paramRoundId);
      const initialRoundId = found ? found.id : list[0]?.id || null;

      setSelectedRoundId(initialRoundId);
      setCreateRoundForm({ roundNumber: list.length + 1, name: `Round ${list.length + 1}` });

      const paramSection = initialSearchParams.get('section');
      if (['overview', 'groups', 'qualifications'].includes(paramSection)) {
        setActiveSection(paramSection);
      }

      const paramGroup = Number(initialSearchParams.get('group'));
      if (paramGroup) {
        setSelectedGroupId(paramGroup);
        const paramTab = initialSearchParams.get('groupTab');
        if (paramTab) setSelectedGroupTab(paramTab);
        const paramMatch = Number(initialSearchParams.get('match'));
        if (paramMatch) setSelectedMatchId(paramMatch);
      }

      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState({ loading: false, actionLoading: false, error: err.message || 'Failed to load rounds.', notice: '' });
    }
  }, [tournamentId]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

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
        const grpList = groupsRes.value?.groups || [];
        setGroups(grpList);

        // If a group was selected via URL, synchronize its state
        const paramGroupId = Number(searchParams.get('group')) || selectedGroupId;
        if (paramGroupId) {
          const matchGrp = grpList.find((g) => g.id === paramGroupId);
          if (matchGrp) {
            setSelectedGroup(matchGrp);
            setGroupRoomForm({ roomId: matchGrp.roomId || '', roomPassword: matchGrp.roomPassword || '', instructions: matchGrp.instructions || '' });
          }
        }
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
  }, [selectedRoundId, searchParams, selectedGroupId]);

  useEffect(() => {
    loadSelectedRoundData();
  }, [loadSelectedRoundData]);

  // 3. Load Group Workspace Details
  const loadGroupWorkspaceData = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const [grpRes, matchRes, leadRes] = await Promise.allSettled([
        fetchGroup(groupId),
        fetchGroupMatches(groupId),
        fetchGroupLeaderboard(groupId),
      ]);

      if (grpRes.status === 'fulfilled' && grpRes.value?.group) {
        setSelectedGroup(grpRes.value.group);
        setGroupRoomForm({
          roomId: grpRes.value.group.roomId || '',
          roomPassword: grpRes.value.group.roomPassword || '',
          instructions: grpRes.value.group.instructions || '',
        });
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
      console.error('Error loading group workspace data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupWorkspaceData(selectedGroupId);
    }
  }, [selectedGroupId, loadGroupWorkspaceData]);

  // 4. Load Match Workspace Details
  const loadMatchWorkspaceData = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const [mRes, resRes, lbRes] = await Promise.allSettled([
        fetchMatch(matchId),
        fetchResults(matchId),
        fetchMatchLeaderboard(matchId),
      ]);

      if (mRes.status === 'fulfilled' && mRes.value?.match) {
        setSelectedMatch(mRes.value.match);
        setMatchRoomForm({
          roomId: mRes.value.match.roomId || '',
          roomPassword: mRes.value.match.roomPassword || '',
          instructions: mRes.value.match.instructions || '',
        });
        setMatchScheduleForm({
          scheduledAt: mRes.value.match.scheduledAt ? mRes.value.match.scheduledAt.slice(0, 16) : '',
          checkInAt: mRes.value.match.checkInAt ? mRes.value.match.checkInAt.slice(0, 16) : '',
          lobbyOpenAt: mRes.value.match.lobbyOpenAt ? mRes.value.match.lobbyOpenAt.slice(0, 16) : '',
        });
      }
      if (resRes.status === 'fulfilled') {
        setMatchResults(resRes.value?.results || []);
      }
      if (lbRes.status === 'fulfilled') {
        setMatchLeaderboard(lbRes.value?.leaderboard || []);
      }
    } catch (err) {
      console.error('Error loading match workspace data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      loadMatchWorkspaceData(selectedMatchId);
    }
  }, [selectedMatchId, loadMatchWorkspaceData]);

  // Round Navigation Handlers
  const handleSelectRound = (roundId) => {
    setSelectedRoundId(roundId);
    setSelectedGroupId(null);
    setSelectedGroup(null);
    setSelectedMatchId(null);
    setSelectedMatch(null);
    updateUrlParams({ newRoundId: roundId, newSection: activeSection, newGroupId: null, newMatchId: null });
  };

  const handleSelectSection = (section) => {
    setActiveSection(section);
    setSelectedGroupId(null);
    setSelectedGroup(null);
    setSelectedMatchId(null);
    setSelectedMatch(null);
    updateUrlParams({ newSection: section, newGroupId: null, newMatchId: null });
  };

  // Group Workspace Navigation Handlers
  const handleOpenGroupWorkspace = (group, defaultTab = 'overview') => {
    setSelectedGroupId(group.id);
    setSelectedGroup(group);
    setSelectedGroupTab(defaultTab);
    setSelectedMatchId(null);
    setSelectedMatch(null);
    setGroupRoomForm({ roomId: group.roomId || '', roomPassword: group.roomPassword || '', instructions: group.instructions || '' });
    updateUrlParams({ newGroupId: group.id, newGroupTab: defaultTab, newMatchId: null });
    loadGroupWorkspaceData(group.id);
  };

  const handleCloseGroupWorkspace = () => {
    setSelectedGroupId(null);
    setSelectedGroup(null);
    setSelectedMatchId(null);
    setSelectedMatch(null);
    updateUrlParams({ newGroupId: null, newGroupTab: null, newMatchId: null });
  };

  const handleSelectGroupTab = (tab, shouldScroll = true) => {
    setSelectedGroupTab(tab);
    setSelectedMatchId(null);
    setSelectedMatch(null);

    // Client-side URL update without React Router full reload / re-mount
    const url = new URL(window.location.href);
    url.searchParams.set('groupTab', tab);
    url.searchParams.delete('match');
    window.history.replaceState(null, '', url.toString());

    if (shouldScroll) {
      setTimeout(() => {
        const targetRef = sectionRefs[tab];
        if (targetRef && targetRef.current) {
          targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 40);
    }
  };

  // Match Workspace Navigation Handlers
  const handleOpenMatchWorkspace = (match) => {
    setSelectedMatchId(match.id);
    setSelectedMatch(match);
    const url = new URL(window.location.href);
    url.searchParams.set('groupTab', 'matches');
    url.searchParams.set('match', match.id);
    window.history.replaceState(null, '', url.toString());
    loadMatchWorkspaceData(match.id);
    setTimeout(() => {
      matchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const handleCloseMatchWorkspace = () => {
    setSelectedMatchId(null);
    setSelectedMatch(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('match');
    window.history.replaceState(null, '', url.toString());
    setTimeout(() => {
      matchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  // Create Round Submit
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
      updateUrlParams({ newRoundId: created.id, newSection: 'overview', newGroupId: null, newMatchId: null });
      setState({
        loading: false,
        actionLoading: false,
        notice: `Round ${created.roundNumber} created successfully.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Delete Round
  const handleDeleteRound = async () => {
    if (!deleteConfirmRound) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteRound(deleteConfirmRound.id);
      const remaining = rounds.filter((r) => r.id !== deleteConfirmRound.id);
      setRounds(remaining);
      setDeleteConfirmRound(null);

      const nextRound = remaining[0] || null;
      setSelectedRoundId(nextRound?.id || null);
      setSelectedGroupId(null);
      setSelectedGroup(null);
      updateUrlParams({ newRoundId: nextRound?.id || null, newSection: 'overview', newGroupId: null, newMatchId: null });

      setState({
        loading: false,
        actionLoading: false,
        notice: `Round ${deleteConfirmRound.roundNumber} deleted.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Complete Round
  const handleCompleteRound = async () => {
    if (!window.confirm('Complete this round and finalize standings for qualification?')) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await completeRound(selectedRoundId);
      setSelectedRound(res.round);
      setRounds((prev) => prev.map((r) => (r.id === selectedRoundId ? res.round : r)));
      setState({
        loading: false,
        actionLoading: false,
        notice: `Round ${res.round.roundNumber} marked COMPLETED.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Lock Assignment
  const handleLockAssignment = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await lockRoundAssignment(selectedRoundId);
      setSelectedRound(res.round);
      setRounds((prev) => prev.map((r) => (r.id === selectedRoundId ? res.round : r)));
      setState({
        loading: false,
        actionLoading: false,
        notice: 'Round assignments LOCKED. Live competition can proceed.',
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Add Custom Group Submit
  const handleAddGroupSubmit = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createGroup(selectedRoundId, {
        name: newGroupForm.name.trim(),
        groupSize: Number(newGroupForm.groupSize),
      });
      setGroups((prev) => [...prev, res.group]);
      setNewGroupForm({ name: '', groupSize: 12 });
      setShowAddGroupModal(false);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Group "${res.group.name}" added to Round.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteGroup(deleteConfirmGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== deleteConfirmGroup.id));
      if (selectedGroupId === deleteConfirmGroup.id) {
        handleCloseGroupWorkspace();
      }
      const grpName = deleteConfirmGroup.name;
      setDeleteConfirmGroup(null);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Group "${grpName}" deleted. Teams returned to pool.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Auto Assign Snake Seeding
  const handleAutoAssign = async (config) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await autoAssignGroups(selectedRoundId, config);
      setGroups(res.groups || []);
      setShowGroupConfig(false);
      setState({
        loading: false,
        actionLoading: false,
        notice: `Auto-generated ${res.groups?.length || 0} balanced groups.`,
        error: '',
      });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Save Group Room
  const handleSaveGroupRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateGroup(selectedGroupId, groupRoomForm);
      setSelectedGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === selectedGroupId ? res.group : g)));
      setState({ loading: false, actionLoading: false, notice: 'Group room credentials saved and broadcasted.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Assign Team in Group Workspace
  const handleAssignTeamToGroup = async (e) => {
    e.preventDefault();
    if (!assignTeamId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await assignTeam(selectedGroupId, assignTeamId);
      setSelectedGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === selectedGroupId ? res.group : g)));
      setAssignTeamId('');
      setState({ loading: false, actionLoading: false, notice: 'Team assigned to group.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Remove Team from Group Workspace
  const handleRemoveTeamFromGroup = async (teamId) => {
    if (!window.confirm('Remove this team from group?')) return;
    try {
      const res = await removeGroupTeam(selectedGroupId, teamId);
      setSelectedGroup(res.group);
      setGroups((prev) => prev.map((g) => (g.id === selectedGroupId ? res.group : g)));
      setState((s) => ({ ...s, notice: 'Team removed from group.' }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  // Schedule Match in Group Workspace
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
      const res = await createMatch(selectedGroupId, payload);
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
      setState({ loading: false, actionLoading: false, notice: 'Match scheduled successfully.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Save Match Room
  const handleSaveMatchRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await updateMatch(selectedMatchId, {
        roomId: matchRoomForm.roomId.trim() || null,
        roomPassword: matchRoomForm.roomPassword.trim() || null,
        instructions: matchRoomForm.instructions.trim() || null,
      });
      setSelectedMatch(res.match);
      setGroupMatches((prev) => prev.map((m) => (m.id === selectedMatchId ? res.match : m)));
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
      const res = await updateMatch(selectedMatchId, {
        scheduledAt: matchScheduleForm.scheduledAt || null,
        checkInAt: matchScheduleForm.checkInAt || null,
        lobbyOpenAt: matchScheduleForm.lobbyOpenAt || null,
      });
      setSelectedMatch(res.match);
      setGroupMatches((prev) => prev.map((m) => (m.id === selectedMatchId ? res.match : m)));
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
      if (selectedMatchId === deleteConfirmMatch.id) {
        handleCloseMatchWorkspace();
      }
      const mName = deleteConfirmMatch.name;
      setDeleteConfirmMatch(null);
      setState({ loading: false, actionLoading: false, notice: `Match "${mName}" deleted.`, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Submit Score in Match Workspace
  const handleMatchScoreSubmit = async (e) => {
    e.preventDefault();
    if (!scoreForm.teamId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createResult(selectedMatchId, scoreForm);
      setMatchResults((prev) => [...prev, res.result]);
      setScoreForm({ teamId: '', points: 0, kills: 0, placement: '', resultText: '', resultMedia: null });

      const lbRes = await recalculateLeaderboard(selectedMatchId);
      setMatchLeaderboard(lbRes.leaderboard || []);

      if (selectedGroupId) {
        const grpLbRes = await fetchGroupLeaderboard(selectedGroupId);
        setGroupLeaderboard(grpLbRes.leaderboard || []);
      }

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
      if (selectedGroupId) {
        const leadRes = await fetchGroupLeaderboard(selectedGroupId);
        setGroupLeaderboard(leadRes.leaderboard || []);
      }
      setQuickScoreModal({ isOpen: false, matchId: null, matchName: '', teamId: '', points: 0, kills: 0, placement: 1, resultText: '' });
      setState({ loading: false, actionLoading: false, notice: 'Score submitted and leaderboard updated.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Recalculate Group Leaderboard
  const handleRecalculateGroupLeaderboard = async () => {
    if (!selectedGroupId) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await fetchGroupLeaderboard(selectedGroupId);
      setGroupLeaderboard(res.leaderboard || []);
      setState({ loading: false, actionLoading: false, notice: 'Group standings refreshed.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  // Qualification handlers
  const handleFinalizeQualifications = async (qualifications) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await finalizeQualifications(selectedRoundId, qualifications);
      setQualCenterData(res);
      setState({ loading: false, actionLoading: false, notice: 'Qualifications finalized for this round.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleReopenQualifications = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await reopenQualifications(selectedRoundId);
      setQualCenterData(res);
      setState({ loading: false, actionLoading: false, notice: 'Qualifications reopened for editing.', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, actionLoading: false, error: err.message }));
    }
  };

  const handleCreateNextRound = async (payload) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const res = await createNextRound(tournamentId, payload);
      setRounds((prev) => [...prev, res.round]);
      setSelectedRoundId(res.round.id);
      setShowNextRoundModal(false);
      updateUrlParams({ newRoundId: res.round.id, newSection: 'overview', newGroupId: null, newMatchId: null });
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

  const isCompletedTournament = tournamentStatus === 'COMPLETED';
  const isLocked = selectedRound?.isLocked || selectedRound?.assignmentStatus === 'LOCKED';

  // Metrics
  const stats = selectedRound?.stats || {
    totalGroups: groups.length,
    completedGroups: groups.filter((g) => g.status === 'COMPLETED').length,
    totalTeams: groups.reduce((acc, g) => acc + (g.teams?.length || 0), 0),
    totalMatches: groups.reduce((acc, g) => acc + (g.matches?.length || 0), 0),
    completedMatches: groups.reduce((acc, g) => acc + (g.matches?.filter((m) => m.status === 'COMPLETED').length || 0), 0),
  };

  if (state.loading) {
    return <div className="status-panel">Loading Tournament Rounds & Groups...</div>;
  }

  return (
    <div className="organizer-rounds-hub">
      {/* Feedback Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '16px' }}>{state.notice}</div>}

      {/* Top Rounds Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {rounds.map((r) => {
            const isSelected = r.id === selectedRoundId;
            return (
              <button
                key={r.id}
                type="button"
                className={isSelected ? 'button primary-button' : 'button secondary-button'}
                style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleSelectRound(r.id)}
              >
                <span>{r.name || `Round ${r.roundNumber}`}</span>
                <span className={`status-badge ${r.status.toLowerCase().replaceAll('_', '-')}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                  {r.status}
                </span>
              </button>
            );
          })}
        </div>

        {!isCompletedTournament && (
          <button
            className="button ghost-button"
            style={{ minHeight: '36px', padding: '0 12px', fontSize: '13px' }}
            type="button"
            onClick={() => setShowCreateRoundModal(true)}
          >
            + New Round
          </button>
        )}
      </div>

      {/* Selected Round Header & Actions */}
      {selectedRound ? (
        <div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span className={`status-badge ${selectedRound.status.toLowerCase().replaceAll('_', '-')}`}>
                    {selectedRound.status}
                  </span>
                  {isLocked && <span className="status-badge" style={{ background: 'rgba(246, 196, 83, 0.15)', color: '#f6c453', border: '1px solid rgba(246, 196, 83, 0.3)' }}>🔒 LOCKED</span>}
                </div>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>{selectedRound.name || `Round ${selectedRound.roundNumber}`}</h2>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!isLocked && !isCompletedTournament && (
                  <button
                    className="button secondary-button"
                    type="button"
                    onClick={handleLockAssignment}
                    disabled={state.actionLoading}
                  >
                    🔒 Lock Assignments
                  </button>
                )}
                {selectedRound.status !== 'COMPLETED' && !isCompletedTournament && (
                  <button
                    className="button primary-button"
                    type="button"
                    onClick={handleCompleteRound}
                    disabled={state.actionLoading}
                  >
                    ✓ Complete Round
                  </button>
                )}
                {selectedRound.status !== 'COMPLETED' && !isCompletedTournament && (
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
          </div>

          {/* Sub-Navigation Strip (Overview | Groups & Assignments | Qualification Center) */}
          <nav className="hub-tabs" role="tablist" style={{ marginBottom: '20px' }}>
            <button
              role="tab"
              aria-selected={activeSection === 'overview'}
              className={activeSection === 'overview' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('overview')}
            >
              Round Overview
            </button>
            <button
              role="tab"
              aria-selected={activeSection === 'groups'}
              className={activeSection === 'groups' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('groups')}
            >
              Groups & Assignments ({groups.length})
            </button>
            <button
              role="tab"
              aria-selected={activeSection === 'qualifications'}
              className={activeSection === 'qualifications' ? 'hub-tab active' : 'hub-tab'}
              onClick={() => handleSelectSection('qualifications')}
            >
              Qualification Center
            </button>
          </nav>

          {/* ========================================================================= */}
          {/* SECTION 1: ROUND OVERVIEW */}
          {/* ========================================================================= */}
          {activeSection === 'overview' && (
            <div>
              {/* Round Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase' }}>Groups</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                    {stats.completedGroups} / {stats.totalGroups} Done
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase' }}>Assigned Teams</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7dd3fc', marginTop: '4px' }}>
                    {stats.totalTeams}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase' }}>Matches</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                    {stats.completedMatches} / {stats.totalMatches} Done
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase' }}>Advancing Quota</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2ecc71', marginTop: '4px' }}>
                    {selectedRound.advancingTeamsCount || 0} Teams
                  </div>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#7dd3fc', fontSize: '16px' }}>Group Management</h4>
                  <p style={{ color: '#91a0b3', fontSize: '13px', marginBottom: '16px' }}>
                    Configure snake-seeded group brackets, adjust team rosters, and manage matches.
                  </p>
                  <button className="button primary-button" type="button" onClick={() => handleSelectSection('groups')}>
                    Manage Groups & Matches →
                  </button>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#2ecc71', fontSize: '16px' }}>Qualification Center</h4>
                  <p style={{ color: '#91a0b3', fontSize: '13px', marginBottom: '16px' }}>
                    Review top ranking teams, finalize qualified rosters, and create the next round.
                  </p>
                  <button className="button secondary-button" type="button" onClick={() => handleSelectSection('qualifications')}>
                    Open Qualification Center →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: GROUPS & ASSIGNMENTS (WITH INLINE WORKSPACE) */}
          {/* ========================================================================= */}
          {activeSection === 'groups' && (
            <div>
              {/* If Setup Wizard Open */}
              {showGroupConfig ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Snake Seeding & Auto-Group Generator</h3>
                    <button className="button ghost-button" type="button" onClick={() => setShowGroupConfig(false)}>
                      ✕ Cancel Wizard
                    </button>
                  </div>
                  <RoundSetupWizard
                    eligibleTeams={eligibleTeams}
                    isSubmitting={state.actionLoading}
                    onAutoAssign={handleAutoAssign}
                  />
                </div>
              ) : null}

              {/* INLINE GROUP WORKSPACE (RENDERED WHEN A GROUP IS SELECTED) */}
              {selectedGroupId && selectedGroup ? (
                <div className="inline-group-workspace">
                  {/* Top Bar: Back Button & Breadcrumbs */}
                  <div className="group-workspace-top-bar">
                    <button
                      type="button"
                      className="button ghost-button"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#7dd3fc' }}
                      onClick={handleCloseGroupWorkspace}
                    >
                      ← Back to All Groups
                    </button>

                    <div className="group-workspace-breadcrumbs">
                      <span>Tournaments</span>
                      <span>/</span>
                      <span>{selectedRound.name || `Round ${selectedRound.roundNumber}`}</span>
                      <span>/</span>
                      <strong style={{ color: '#fff' }}>{selectedGroup.name}</strong>
                    </div>
                  </div>

                  {/* Group Workspace Header Banner */}
                  <div className="group-workspace-header-banner">
                    <div className="group-workspace-title-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`status-badge ${selectedGroup.status.toLowerCase().replaceAll('_', '-')}`}>
                          {selectedGroup.status}
                        </span>
                        <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                          Round {selectedRound.roundNumber} Stage
                        </span>
                      </div>
                      <h2 className="group-workspace-title">{selectedGroup.name} Workspace</h2>
                      <div className="group-workspace-meta-row">
                        <span><strong>{selectedGroup.teams?.length || 0}</strong> / {selectedGroup.groupSize || 12} Teams</span>
                        <span>·</span>
                        <span><strong>{groupMatches.length}</strong> Matches</span>
                        <span>·</span>
                        <span>Room: <strong style={{ color: selectedGroup.roomId ? '#2ecc71' : '#f6c453' }}>{selectedGroup.roomId ? 'Configured' : 'Not Set'}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        className="button primary-button"
                        style={{ minHeight: '34px', fontSize: '12px' }}
                        type="button"
                        onClick={() => handleSelectGroupTab('matches')}
                      >
                        Manage Matches
                      </button>
                      <button
                        className="button secondary-button"
                        style={{ minHeight: '34px', fontSize: '12px' }}
                        type="button"
                        onClick={() => handleSelectGroupTab('room')}
                      >
                        Room Credentials
                      </button>
                    </div>
                  </div>

                  {/* Group Workspace Subtabs Navigation */}
                  <nav className="group-workspace-subtabs-nav" role="tablist">
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'overview'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'overview' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('overview')}
                    >
                      Overview
                    </button>
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'room'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'room' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('room')}
                    >
                      Room & Lobby
                    </button>
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'matches'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'matches' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('matches')}
                    >
                      Matches ({groupMatches.length})
                    </button>
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'leaderboard'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'leaderboard' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('leaderboard')}
                    >
                      Standings & Leaderboard
                    </button>
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'teams'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'teams' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('teams')}
                    >
                      Teams ({selectedGroup.teams?.length || 0})
                    </button>
                    <button
                      role="tab"
                      aria-selected={selectedGroupTab === 'chat'}
                      className={`group-workspace-subtab-btn ${selectedGroupTab === 'chat' ? 'active' : ''}`}
                      onClick={() => handleSelectGroupTab('chat')}
                    >
                      Group Chat
                    </button>
                  </nav>

                  {/* TAB 1: OVERVIEW */}
                  {selectedGroupTab === 'overview' && (
                    <div ref={overviewRef} className="group-workspace-section-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Operational Stats Grid */}
                      <div className="group-overview-stats-grid">
                        <div className="group-overview-stat-card">
                          <span className="stat-label">Group Status</span>
                          <span className="stat-val" style={{ fontSize: '16px', marginTop: '4px' }}>
                            <span className={`status-badge ${selectedGroup.status.toLowerCase().replaceAll('_', '-')}`}>
                              {selectedGroup.status}
                            </span>
                          </span>
                        </div>
                        <div className="group-overview-stat-card">
                          <span className="stat-label">Assigned Teams</span>
                          <span className="stat-val">{selectedGroup.teams?.length || 0} / {selectedGroup.groupSize || 12}</span>
                        </div>
                        <div className="group-overview-stat-card">
                          <span className="stat-label">Matches Completed</span>
                          <span className="stat-val">
                            {groupMatches.filter((m) => m.status === 'COMPLETED').length} / {groupMatches.length}
                          </span>
                        </div>
                        <div className="group-overview-stat-card">
                          <span className="stat-label">Room Credentials</span>
                          <span className="stat-val" style={{ fontSize: '15px', color: selectedGroup.roomId ? '#2ecc71' : '#f6c453' }}>
                            {selectedGroup.roomId ? `ID: ${selectedGroup.roomId}` : 'Not Configured'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Navigation Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 6px 0', color: '#7dd3fc', fontSize: '15px' }}>Room Credentials</h4>
                          <p style={{ color: '#91a0b3', fontSize: '12px', marginBottom: '12px' }}>Configure custom game lobby ID and password for teams.</p>
                          <button className="button secondary-button" style={{ minHeight: '30px', fontSize: '12px' }} onClick={() => handleSelectGroupTab('room')}>
                            Configure Room →
                          </button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 6px 0', color: '#2ecc71', fontSize: '15px' }}>Matches & Results</h4>
                          <p style={{ color: '#91a0b3', fontSize: '12px', marginBottom: '12px' }}>Schedule match times, notify players, and record team kills & positions.</p>
                          <button className="button primary-button" style={{ minHeight: '30px', fontSize: '12px' }} onClick={() => handleSelectGroupTab('matches')}>
                            Manage Matches ({groupMatches.length}) →
                          </button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 6px 0', color: '#f6c453', fontSize: '15px' }}>Group Standings</h4>
                          <p style={{ color: '#91a0b3', fontSize: '12px', marginBottom: '12px' }}>View real-time authoritative leaderboard and team points.</p>
                          <button className="button secondary-button" style={{ minHeight: '30px', fontSize: '12px' }} onClick={() => handleSelectGroupTab('leaderboard')}>
                            View Standings →
                          </button>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      {selectedGroup.status !== 'COMPLETED' && !isCompletedTournament && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px', marginTop: '10px' }}>
                          <h4 style={{ margin: '0 0 6px 0', color: '#ef4444', fontSize: '14px' }}>Delete Group</h4>
                          <p style={{ color: '#91a0b3', fontSize: '12px', marginBottom: '12px' }}>
                            Removes group assignments and unplayed matches. Teams return to the unassigned tournament pool safely.
                          </p>
                          <button
                            className="button danger-button"
                            type="button"
                            style={{ minHeight: '32px', fontSize: '12px' }}
                            onClick={() => setDeleteConfirmGroup(selectedGroup)}
                          >
                            Delete This Group
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ROOM & LOBBY */}
                  {selectedGroupTab === 'room' && (
                    <div ref={roomRef} className="group-workspace-section-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <form onSubmit={handleSaveGroupRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#7dd3fc', fontSize: '16px' }}>Group Room Credentials</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label htmlFor="group-room-id" style={{ fontSize: '12px', color: '#91a0b3' }}>In-Game Room ID</label>
                              {groupRoomForm.roomId && (
                                <button
                                  type="button"
                                  className="button secondary-button"
                                  style={{ minHeight: '22px', padding: '0 6px', fontSize: '10px' }}
                                  onClick={() => handleCopy(groupRoomForm.roomId, 'grp-room-id')}
                                >
                                  {copiedField === 'grp-room-id' ? '✓ Copied' : 'Copy'}
                                </button>
                              )}
                            </div>
                            <input
                              id="group-room-id"
                              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px' }}
                              value={groupRoomForm.roomId}
                              onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomId: e.target.value })}
                              placeholder="e.g. 5839201"
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label htmlFor="group-room-pw" style={{ fontSize: '12px', color: '#91a0b3' }}>Room Password</label>
                              {groupRoomForm.roomPassword && (
                                <button
                                  type="button"
                                  className="button secondary-button"
                                  style={{ minHeight: '22px', padding: '0 6px', fontSize: '10px' }}
                                  onClick={() => handleCopy(groupRoomForm.roomPassword, 'grp-room-pw')}
                                >
                                  {copiedField === 'grp-room-pw' ? '✓ Copied' : 'Copy'}
                                </button>
                              )}
                            </div>
                            <input
                              id="group-room-pw"
                              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px' }}
                              value={groupRoomForm.roomPassword}
                              onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomPassword: e.target.value })}
                              placeholder="e.g. evo123"
                            />
                          </div>
                        </div>

                        <label htmlFor="group-room-instructions" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>
                          Room Instructions / Lobby Slot Notes (Optional)
                        </label>
                        <textarea
                          id="group-room-instructions"
                          rows="2"
                          style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '8px 10px', marginBottom: '16px' }}
                          value={groupRoomForm.instructions}
                          onChange={(e) => setGroupRoomForm({ ...groupRoomForm, instructions: e.target.value })}
                          placeholder="e.g. Slot numbers correspond to Group Team Number. Join 10m before start."
                        />

                        <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                          Save Group Room Credentials
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 3: MATCHES & INLINE MATCH MANAGEMENT */}
                  {selectedGroupTab === 'matches' && (
                    <div ref={matchesRef} className="group-workspace-section-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Sub-view: Inline Match Workspace if a match is selected */}
                      {selectedMatchId && selectedMatch ? (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(125, 211, 252, 0.3)', borderRadius: '8px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <button
                              type="button"
                              className="button ghost-button"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#7dd3fc', fontWeight: 'bold' }}
                              onClick={handleCloseMatchWorkspace}
                            >
                              ← Back to Matches List
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`status-badge ${selectedMatch.status.toLowerCase().replaceAll('_', '-')}`}>
                                {selectedMatch.status}
                              </span>
                              <span style={{ fontSize: '13px', color: '#7dd3fc' }}>Match #{selectedMatch.matchNumber}</span>
                            </div>
                          </div>

                          <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#fff' }}>
                            {selectedMatch.name}
                          </h3>

                          {/* Match Room & Schedule 2-Column */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {/* Match Room Form */}
                            <form onSubmit={handleSaveMatchRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Match Room Credentials</h4>
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

                            {/* Match Schedule Form */}
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

                          {/* Record Team Score Form */}
                          <form onSubmit={handleMatchScoreSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '14px' }}>Record Team Score</h4>
                            <select
                              style={{ width: '100%', minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '10px' }}
                              value={scoreForm.teamId}
                              onChange={(e) => setScoreForm({ ...scoreForm, teamId: e.target.value })}
                              required
                            >
                              <option value="">Select team from group...</option>
                              {selectedGroup?.teams?.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Placement</label>
                                <input
                                  type="number"
                                  min="1"
                                  style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                  value={scoreForm.placement}
                                  onChange={(e) => setScoreForm({ ...scoreForm, placement: e.target.value })}
                                  placeholder="e.g. 1"
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Kills</label>
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                  value={scoreForm.kills}
                                  onChange={(e) => setScoreForm({ ...scoreForm, kills: e.target.value })}
                                  placeholder="Kills"
                                  required
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Points</label>
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                  value={scoreForm.points}
                                  onChange={(e) => setScoreForm({ ...scoreForm, points: e.target.value })}
                                  placeholder="Points"
                                  required
                                />
                              </div>
                            </div>

                            <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                              Save Result
                            </button>
                          </form>

                          {/* Match Results Table */}
                          <div>
                            <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '14px' }}>Recorded Results ({matchResults.length})</h4>
                            {matchResults.length === 0 ? (
                              <p style={{ color: '#91a0b3', fontSize: '13px' }}>No results recorded for this match yet.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                  <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Placement</th>
                                    <th style={{ padding: '8px' }}>Team</th>
                                    <th style={{ padding: '8px' }}>Kills</th>
                                    <th style={{ padding: '8px' }}>Points</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {matchResults.map((r, i) => (
                                    <tr key={r.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <td style={{ padding: '8px', color: '#fff', fontWeight: 'bold' }}>#{r.placement || i + 1}</td>
                                      <td style={{ padding: '8px', color: '#fff' }}>{r.teamName}</td>
                                      <td style={{ padding: '8px', color: '#91a0b3' }}>{r.kills}</td>
                                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#7dd3fc' }}>{r.points}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Matches List View */
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Group Matches ({groupMatches.length})</h3>
                            {!isCompletedTournament && (
                              <button
                                className="button secondary-button"
                                style={{ minHeight: '32px', fontSize: '12px' }}
                                type="button"
                                onClick={() => setShowAddMatchForm(!showAddMatchForm)}
                              >
                                {showAddMatchForm ? '✕ Close Form' : '+ Schedule New Match'}
                              </button>
                            )}
                          </div>

                          {/* Add Match Expandable Form */}
                          {showAddMatchForm && (
                            <form onSubmit={handleScheduleMatchInGroup} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                              <h4 style={{ margin: '0 0 12px 0', color: '#7dd3fc', fontSize: '14px' }}>Schedule New Match in {selectedGroup.name}</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Match Number</label>
                                  <input
                                    type="number"
                                    min="1"
                                    style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                    value={addMatchForm.matchNumber}
                                    onChange={(e) => setAddMatchForm({ ...addMatchForm, matchNumber: e.target.value, name: `Match ${e.target.value}` })}
                                    required
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Match Title</label>
                                  <input
                                    style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                    value={addMatchForm.name}
                                    onChange={(e) => setAddMatchForm({ ...addMatchForm, name: e.target.value })}
                                    required
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#91a0b3', marginBottom: '2px' }}>Scheduled Start</label>
                                  <input
                                    type="datetime-local"
                                    style={{ width: '100%', minHeight: '34px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                                    value={addMatchForm.scheduledAt}
                                    onChange={(e) => setAddMatchForm({ ...addMatchForm, scheduledAt: e.target.value })}
                                  />
                                </div>
                              </div>
                              <button className="button primary-button" type="submit" disabled={state.actionLoading}>
                                Create Match
                              </button>
                            </form>
                          )}

                          {/* Matches Cards */}
                          {groupMatches.length === 0 ? (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#91a0b3' }}>
                              No matches scheduled yet for {selectedGroup.name}.
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                              {groupMatches.map((m) => (
                                <div key={m.id} className="group-inline-match-card">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div>
                                      <strong style={{ color: '#7dd3fc', fontSize: '13px' }}>#{m.matchNumber}</strong>
                                      <span style={{ color: '#fff', fontWeight: 'bold', marginLeft: '6px' }}>{m.name}</span>
                                    </div>
                                    <span className={`status-badge ${m.status.toLowerCase().replaceAll('_', '-')}`} style={{ fontSize: '10px' }}>
                                      {m.status}
                                    </span>
                                  </div>

                                  <div style={{ fontSize: '12px', color: '#91a0b3', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div>
                                      <span>Schedule: </span>
                                      <strong style={{ color: '#fff' }}>
                                        {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'No schedule set'}
                                      </strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                                      <span>Room ID: <strong style={{ color: m.roomId ? '#2ecc71' : '#64748b' }}>{m.roomId || selectedGroup.roomId || 'Not set'}</strong></span>
                                      <span>Password: <strong style={{ color: m.roomPassword ? '#f6c453' : '#64748b' }}>{m.roomPassword || selectedGroup.roomPassword || 'Not set'}</strong></span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <button
                                      className="button primary-button"
                                      style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                                      type="button"
                                      onClick={() => handleOpenMatchWorkspace(m)}
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
                                      onClick={() => setQuickScoreModal({ isOpen: true, matchId: m.id, matchName: m.name, teamId: selectedGroup.teams?.[0]?.id || '', points: 0, kills: 0, placement: 1, resultText: '' })}
                                    >
                                      + Score
                                    </button>
                                    {!isCompletedTournament && (
                                      <button
                                        className="button ghost-button danger-text"
                                        style={{ minHeight: '28px', padding: '0 6px', fontSize: '11px' }}
                                        type="button"
                                        onClick={() => setDeleteConfirmMatch(m)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 4: LEADERBOARD */}
                  {selectedGroupTab === 'leaderboard' && (
                    <div ref={leaderboardRef} className="group-workspace-section-panel" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>{selectedGroup.name} Standings</h3>
                          <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                            Scoring Mode: <strong>{scoringMode === 'TOTAL_SCORE' ? 'Total Score Only' : 'Kills + Position Points'}</strong>
                          </span>
                        </div>
                        <button
                          className="button secondary-button"
                          style={{ minHeight: '30px', fontSize: '12px' }}
                          type="button"
                          onClick={handleRecalculateGroupLeaderboard}
                        >
                          Refresh Leaderboard
                        </button>
                      </div>

                      {groupLeaderboard.length === 0 ? (
                        <p style={{ color: '#91a0b3', fontSize: '13px' }}>No match scores recorded for {selectedGroup.name} yet.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', textAlign: 'left' }}>
                              <th style={{ padding: '10px' }}>Rank</th>
                              <th style={{ padding: '10px' }}>Team</th>
                              {scoringMode !== 'TOTAL_SCORE' && <th style={{ padding: '10px' }}>Kills</th>}
                              {scoringMode !== 'TOTAL_SCORE' && <th style={{ padding: '10px' }}>Position Pts</th>}
                              <th style={{ padding: '10px' }}>Total Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupLeaderboard.map((r, i) => (
                              <tr key={r.teamId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '10px', color: '#fff', fontWeight: 'bold' }}>#{r.rank || i + 1}</td>
                                <td style={{ padding: '10px', color: '#fff' }}>{r.teamName}</td>
                                {scoringMode !== 'TOTAL_SCORE' && <td style={{ padding: '10px', color: '#91a0b3' }}>{r.kills || 0}</td>}
                                {scoringMode !== 'TOTAL_SCORE' && <td style={{ padding: '10px', color: '#91a0b3' }}>{r.positionPoints || 0}</td>}
                                <td style={{ padding: '10px', fontWeight: 'bold', color: '#7dd3fc' }}>{r.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 5: TEAMS */}
                  {selectedGroupTab === 'teams' && (
                    <div ref={teamsRef} className="group-workspace-section-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Assign Team Form */}
                      {!isLocked && !isCompletedTournament && (
                        <form onSubmit={handleAssignTeamToGroup} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Assign Eligible Team to {selectedGroup.name}</h4>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <select
                              style={{ flex: 1, minHeight: '36px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px' }}
                              value={assignTeamId}
                              onChange={(e) => setAssignTeamId(e.target.value)}
                            >
                              <option value="">Select unassigned team ({eligibleTeams.filter(t => !groups.some(g => g.teams?.some(gt => gt.id === t.id))).length} available)...</option>
                              {eligibleTeams
                                .filter((t) => !groups.some((g) => g.teams?.some((gt) => gt.id === t.id)))
                                .map((t) => (
                                  <option key={t.id} value={t.id}>{t.name} (Seed: {t.seed || 'Unseeded'})</option>
                                ))}
                            </select>
                            <button className="button primary-button" type="submit" disabled={!assignTeamId || state.actionLoading}>
                              Assign to Group
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Assigned Teams List */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px' }}>
                          Assigned Teams ({selectedGroup.teams?.length || 0} / {selectedGroup.groupSize || 12})
                        </h4>
                        {!selectedGroup.teams || selectedGroup.teams.length === 0 ? (
                          <p style={{ color: '#91a0b3', fontSize: '13px' }}>No teams assigned to this group yet.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                            {selectedGroup.teams.map((t, i) => (
                              <div key={t.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ color: '#fff', fontSize: '14px' }}>{t.name}</strong>
                                  <div style={{ fontSize: '11px', color: '#91a0b3' }}>Seed #{t.seed || i + 1}</div>
                                </div>
                                {!isLocked && !isCompletedTournament && (
                                  <button
                                    className="button ghost-button danger-text"
                                    style={{ minHeight: '26px', padding: '0 6px', fontSize: '11px' }}
                                    type="button"
                                    onClick={() => handleRemoveTeamFromGroup(t.id)}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: CHAT */}
                  {selectedGroupTab === 'chat' && (
                    <div ref={chatRef} className="group-workspace-section-panel" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                      <GroupChatView groupId={selectedGroup.id} groupName={selectedGroup.name} isCompleted={selectedGroup.status === 'COMPLETED'} />
                    </div>
                  )}
                </div>
              ) : (
                /* DEFAULT GROUPS LIST VIEW (WHEN NO GROUP IS OPEN) */
                <>
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
                                onClick={() => handleOpenGroupWorkspace(group)}
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
                </>
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
      {/* DIALOG MODALS: CREATE ROUND / ADD GROUP / QUICK SCORE / DELETIONS */}
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
              {selectedGroup?.teams?.map((t) => (
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

      {/* DELETE CONFIRMATION: ROUND */}
      {deleteConfirmRound && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(460px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Round</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmRound.name || `Round ${deleteConfirmRound.roundNumber}`}</strong>?
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#fca5a5', marginBottom: '20px' }}>
              <strong>Safety Protection:</strong> Deleting a round removes its draft group configurations and unplayed matches. The underlying registered teams and players remain fully preserved in the tournament pool.
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

      {/* DELETE CONFIRMATION: GROUP */}
      {deleteConfirmGroup && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(450px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Group</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmGroup.name}</strong>?
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#fca5a5', marginBottom: '20px' }}>
              <strong>Safety Protection:</strong> Deleting a group unassigns teams back to the tournament pool and deletes scheduled matches without results.
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

      {/* DELETE CONFIRMATION: MATCH */}
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
