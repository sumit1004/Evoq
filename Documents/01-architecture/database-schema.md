# EVOQ Database Architecture

## Design goals

-   MySQL
-   foreign-key integrity
-   explicit lifecycle data
-   tournament isolation
-   reusable teams
-   first-class matches
-   transactional completion/archive
-   indexes for common access paths

## Canonical tables

### users

Core identity. Suggested fields: id, name, email, password_hash, role,
created_at, updated_at

### player_profiles

Player-specific data. Suggested fields: user_id, unique_player_id,
mobile, in_game_name, game_uid, created_at, updated_at

unique_player_id must be unique.

### teams

Reusable team identity. Suggested fields: id, name, owner_id,
created_at, updated_at

### team_members

Many-to-many membership. Suggested fields: id, team_id, user_id, role,
joined_at

Unique(team_id, user_id).

### tournaments

Suggested: id, organizer_id, name, description, tournament_date,
registration_start_at, registration_end_at, max_teams, players_per_team,
entry_type, entry_fee, payment_qr_path, payment_instructions, status,
created_at, updated_at, completed_at

### tournament_prizes

Dynamic prize positions. Suggested: id, tournament_id, position, amount

Unique(tournament_id, position).

### registrations

Suggested: id, tournament_id, team_id, status, transaction_id,
payment_screenshot_path, submitted_at, verified_at, verified_by,
rejection_reason, created_at, updated_at

Unique(tournament_id, team_id).

### rounds

Suggested: id, tournament_id, round_number, name, status, started_at,
completed_at, created_at, updated_at

Unique(tournament_id, round_number).

### groups

Suggested: id, round_id, name, status, group_size, room_id,
room_password, started_at, completed_at, created_at, updated_at

Unique(round_id, name).

### group_teams

Assignment entity. Suggested: id, group_id, team_id, assigned_at

Unique(group_id, team_id).

The database must also enforce or service-enforce that a team cannot be
assigned to conflicting groups within the same round.

### matches

First-class match entity. Suggested: id, group_id, match_number, name,
status, scheduled_at, started_at, completed_at, created_at, updated_at

Unique(group_id, match_number).

### match_results

Result data scoped to match/team. Suggested: id, match_id, team_id,
points, kills, placement, result_text, uploaded_by, created_at,
updated_at

Unique(match_id, team_id).

### leaderboard_entries

Persisted leaderboard snapshot/entry. Suggested: id, match_id, team_id,
points, kills, rank, created_at, updated_at

Unique(match_id, team_id).

If group/round aggregate leaderboards are persisted, add explicit scope
fields and uniqueness constraints rather than overloading match_number.

### qualifications

Suggested: id, round_id, team_id, source_group_id, selected_by,
selected_at

Unique(round_id, team_id).

### announcements

id, tournament_id, created_by, message, created_at

### notifications

id, user_id, tournament_id, type, content, read_at, created_at

### chat_messages

id, group_id, sender_id, message, created_at

### tournament_archives

Lightweight completed snapshot. Suggested: id, tournament_id,
tournament_name, completed_at, registration_count,
final_leaderboard_json, qualified_teams_json, winners_json,
summary_json, created_at

Unique(tournament_id).

## Key foreign keys

Use foreign keys for all relationships. Use ON DELETE CASCADE only where
deletion is intentionally safe. Do not use broad cascade rules that
could accidentally erase reusable users or teams.

## Indexes

At minimum: - users.email - player_profiles.unique_player_id -
team_members.team_id - team_members.user_id -
registrations.tournament_id/status - registrations.team_id -
rounds.tournament_id/status - groups.round_id/status -
group_teams.group_id/team_id - matches.group_id/status -
match_results.match_id/team_id - leaderboard_entries.match_id/team_id -
qualifications.round_id/team_id -
announcements.tournament_id/created_at - notifications.user_id/read_at -
chat_messages.group_id/created_at

## Important architecture decision

The older supplied analysis sometimes models teams with tournament_id
and matches using match_number fields. The production schema defined
here intentionally uses reusable teams, registration as tournament
participation, and a first-class matches table because those structures
better match the master product specification and prevent result
overwrites.
