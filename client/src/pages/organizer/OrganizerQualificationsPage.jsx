import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createNextRound,
  fetchQualificationCenter,
  finalizeQualifications,
  getRound,
  reopenQualifications,
} from '../../services/competitionApi.js';
import { QualificationCenterView } from '../../components/organizer/QualificationCenterView.jsx';
import { NextRoundModal } from '../../components/organizer/NextRoundModal.jsx';

export function OrganizerQualificationsPage() {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [groups, setGroups] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);
  const [state, setState] = useState({
    loading: true,
    submitting: false,
    error: '',
    notice: '',
  });

  const loadData = useCallback(async () => {
    if (!roundId || Number.isNaN(Number(roundId))) {
      setState({ loading: false, submitting: false, error: 'Invalid round ID', notice: '' });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const [centerRes, roundRes] = await Promise.all([
        fetchQualificationCenter(roundId),
        getRound(roundId).catch(() => ({ round: null })),
      ]);

      if (roundRes?.round) setRound(roundRes.round);
      else if (centerRes) {
        setRound({
          id: centerRes.roundId,
          roundNumber: centerRes.roundNumber,
          qualificationsFinalizedAt: centerRes.qualificationsFinalizedAt,
        });
      }

      setGroups(centerRes.groups || []);
      setQualifications(centerRes.qualifications || []);
      setState({ loading: false, submitting: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  }, [roundId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Finalize qualifications
  const handleFinalize = async (payload) => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await finalizeQualifications(roundId, payload);
      setQualifications(result.qualifications || []);
      setRound((prev) => ({
        ...prev,
        qualificationsFinalizedAt: new Date().toISOString(),
      }));
      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: `Successfully finalized ${payload.selections.length} qualifying teams.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Reopen qualifications
  const handleReopen = async () => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await reopenQualifications(roundId);
      setQualifications(result.qualifications || []);
      setRound((prev) => ({
        ...prev,
        qualificationsFinalizedAt: null,
      }));
      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: 'Qualification reopened for editing.',
      });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Create next round from qualified pool
  const handleCreateNextRound = async (input) => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createNextRound(tournamentId, input);
      setShowNextRoundModal(false);
      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: `Round ${result.round.roundNumber} successfully created.`,
      });
      // Navigate to the newly created round groups page
      navigate(`/organizer/tournaments/${tournamentId}/rounds/${result.round.id}/groups`);
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  return (
    <section className="workspace-page">
      <div className="workspace-nav-bar">
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}?tab=rounds`}>
          Back to tournament rounds
        </Link>
        <Link
          className="button ghost-button"
          to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/groups`}
        >
          Manage Groups
        </Link>
      </div>

      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}

      {state.loading && <p className="status-panel">Loading group standings and qualifications...</p>}

      {!state.loading && (
        <>
          <QualificationCenterView
            tournamentId={tournamentId}
            round={round}
            groups={groups}
            qualifications={qualifications}
            isSubmitting={state.submitting}
            onFinalize={handleFinalize}
            onReopen={handleReopen}
            onCreateNextRound={() => setShowNextRoundModal(true)}
          />

          <NextRoundModal
            tournamentId={tournamentId}
            currentRoundNumber={round?.roundNumber || 1}
            qualifiedTeams={qualifications}
            isCreating={state.submitting}
            isOpen={showNextRoundModal}
            onClose={() => setShowNextRoundModal(false)}
            onSubmit={handleCreateNextRound}
          />
        </>
      )}
    </section>
  );
}
