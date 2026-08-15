# EVOQ Realtime Architecture

## Technology

Socket.IO with JWT authentication.

## Connection

Client sends JWT through Socket.IO auth: auth: { token }

Server validates token in Socket.IO middleware and attaches
authenticated user context.

## Rooms

user\_`<userId>`{=html} tournament\_`<tournamentId>`{=html}
round\_`<roundId>`{=html} group\_`<groupId>`{=html}

Rooms are subscriptions, not permissions.

## Joining

Server or authorized client actions establish room membership only after
validating access.

## Event categories

### Server → client

announcement notification chat_message leaderboard_update result_update
room_update group_status round_status tournament_status
tournament_completed

### Client → server

join_tournament join_group send_message request_room_update (only where
needed) Privileged actions may use REST rather than sockets; if socket
actions exist, they invoke the same services as REST.

## Event flow

Mutation: Client → REST/service or authorized socket action → service
validates rules → MySQL transaction → commit → Socket.IO emit → clients
update state

Never emit a successful domain event before the transaction has
committed.

## State merging

Arrays must use functional updates: setItems(prev =\> \[newItem,
...prev\])

Do not replace existing history with a single socket payload.

## Listener cleanup

Every useEffect that registers a listener must remove the same named
handler: socket.on(event, handler) return () =\> socket.off(event,
handler)

Avoid anonymous handlers when cleanup identity matters.

## Reconnection

On reconnect: - socket re-authenticates - client/server restore
authorized room subscriptions - initial state may be refetched where
necessary - duplicate listeners must not be created

## Notifications

Chat messages never generate global notification entries.

## Security

Never trust a client-provided room membership or userId. Resolve
identity from authenticated socket context and validate resource access.

## Scalability

If multiple Socket.IO instances are deployed, introduce a compatible
shared adapter/pub-sub layer. Do not add this dependency until
horizontal scaling is actually required.
