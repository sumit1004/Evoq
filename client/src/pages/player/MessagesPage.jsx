import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  fetchConversations,
  fetchConversationDetails,
  fetchConversationMessages,
  sendDirectMessage,
  markConversationRead,
} from '../../services/directMessageApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { normalizeApiError } from '../../services/apiClient.js';

export function MessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { identity } = useAuth();
  const { on } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Load Conversations List
  const loadConversations = useCallback(async () => {
    try {
      setLoadingList(true);
      setError('');
      const data = await fetchConversations();
      setConversations(data);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load Active Conversation & Messages
  const loadActiveChat = useCallback(async (convId) => {
    if (!convId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    try {
      setLoadingChat(true);
      setError('');
      const [conv, msgData] = await Promise.all([
        fetchConversationDetails(convId),
        fetchConversationMessages(convId, { limit: 50 }),
      ]);
      setActiveConversation(conv);
      setMessages(msgData.messages || []);

      // Mark as read immediately
      await markConversationRead(convId);

      // Decrement unread count locally
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(convId) ? { ...c, unreadCount: 0 } : c,
        ),
      );
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadActiveChat(conversationId);
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [conversationId, loadActiveChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Realtime Socket Event Subscriptions
  useEffect(() => {
    const handleIncomingMessage = (incoming) => {
      if (!incoming) return;

      const incConvId = String(incoming.conversationId);

      // Update active chat if viewing this conversation
      if (conversationId && incConvId === String(conversationId)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        markConversationRead(conversationId).catch(() => {});
      }

      // Update conversations list snippet and unread counter
      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c.id) === incConvId);
        if (index === -1) {
          // New conversation, trigger full refresh
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const target = { ...updated[index] };
        target.lastMessage = incoming.message;
        target.lastMessageAt = incoming.createdAt;
        target.lastMessageSenderId = incoming.senderId;

        if (String(conversationId) !== incConvId && Number(incoming.senderId) !== Number(identity?.id)) {
          target.unreadCount = (target.unreadCount || 0) + 1;
        }

        updated.splice(index, 1);
        return [target, ...updated];
      });
    };

    const handleMessageRead = (readEvent) => {
      if (!readEvent) return;
      if (conversationId && String(readEvent.conversationId) === String(conversationId)) {
        setMessages((prev) =>
          prev.map((m) => (m.readAt ? m : { ...m, readAt: readEvent.readAt })),
        );
      }
    };

    const removeMsgListener = on('direct_message', handleIncomingMessage);
    const removeReadListener = on('direct_message_read', handleMessageRead);

    return () => {
      if (typeof removeMsgListener === 'function') removeMsgListener();
      if (typeof removeReadListener === 'function') removeReadListener();
    };
  }, [conversationId, identity?.id, loadConversations, on]);

  // 4. Send Message Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const created = await sendDirectMessage(conversationId, text);

      // Optimistically add to messages
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });

      // Update conversation list item
      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c.id) === String(conversationId));
        if (index === -1) return prev;
        const updated = [...prev];
        const target = { ...updated[index] };
        target.lastMessage = created.message;
        target.lastMessageAt = created.createdAt;
        target.lastMessageSenderId = created.senderId;
        updated.splice(index, 1);
        return [target, ...updated];
      });
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const otherName = (c.participant?.name || '').toLowerCase();
    const otherIgn = (c.participant?.inGameName || '').toLowerCase();
    const otherId = (c.participant?.uniquePlayerId || '').toLowerCase();
    const orgName = (c.organizationName || '').toLowerCase();
    return otherName.includes(q) || otherIgn.includes(q) || otherId.includes(q) || orgName.includes(q);
  });

  const getDisplayName = (conv) => {
    if (conv.type === 'ORGANIZATION' && conv.organizationName) {
      return conv.organizationName;
    }
    return conv.participant?.name || 'Player';
  };

  const getDisplayAvatar = (conv) => {
    if (conv.type === 'ORGANIZATION') {
      return conv.organizationLogoUrl ? (
        <img src={conv.organizationLogoUrl} alt={conv.organizationName || 'Org'} />
      ) : (
        (conv.organizationName || 'O').slice(0, 2).toUpperCase()
      );
    }
    return conv.participant?.avatarUrl ? (
      <img src={conv.participant.avatarUrl} alt={conv.participant.name} />
    ) : (
      (conv.participant?.name || 'P').slice(0, 2).toUpperCase()
    );
  };

  return (
    <section className="workspace-page">
      <div className="page-header" style={{ marginBottom: '0.5rem' }}>
        <div className="page-kicker">Direct Messaging</div>
        <h1>Messages</h1>
        <p>Private 1-to-1 conversations with players and organizations.</p>
      </div>

      {error && (
        <div className="dashboard-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => conversationId ? loadActiveChat(conversationId) : loadConversations()}>
            Retry
          </button>
        </div>
      )}

      <div className={`messaging-container ${conversationId ? 'has-active-chat' : ''}`}>
        {/* Left Panel: Conversation List */}
        <aside className="conversations-sidebar">
          <div className="conversations-header">
            <h2>Conversations</h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {conversations.length} total
            </span>
          </div>

          <div className="conversations-search">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ul className="conversations-list">
            {loadingList && (
              <li style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                Loading conversations...
              </li>
            )}

            {!loadingList && filteredConversations.length === 0 && (
              <li style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <strong style={{ display: 'block', color: '#f6f8fb', marginBottom: '0.25rem' }}>
                  No conversations found
                </strong>
                <p style={{ fontSize: '0.825rem', margin: 0 }}>
                  Start a conversation from a player profile or organization page.
                </p>
              </li>
            )}

            {!loadingList &&
              filteredConversations.map((conv) => {
                const isActive = String(conv.id) === String(conversationId);
                const isOrg = conv.type === 'ORGANIZATION';
                return (
                  <li key={conv.id}>
                    <div
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() => navigate(`/player/messages/${conv.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={`conversation-avatar ${isOrg ? 'org-avatar' : ''}`}>
                        {getDisplayAvatar(conv)}
                      </div>

                      <div className="conversation-info">
                        <div className="conversation-top">
                          <span className="conversation-name">
                            {isOrg && <span className="conversation-type-tag">ORG</span>}
                            {getDisplayName(conv)}
                          </span>
                          {conv.lastMessageAt && (
                            <span className="conversation-time">
                              {new Date(conv.lastMessageAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>

                        <div className="conversation-bottom">
                          <p className="conversation-snippet">
                            {conv.lastMessage || 'No messages yet'}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="conversation-badge">{conv.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </aside>

        {/* Right Panel: Active Chat View */}
        <main className="chat-window">
          {conversationId && activeConversation ? (
            <>
              {/* Header */}
              <div className="chat-header">
                <div className="chat-header-left">
                  <button
                    className="chat-back-button"
                    type="button"
                    onClick={() => navigate('/player/messages')}
                    title="Back to conversations"
                  >
                    Back
                  </button>

                  <div
                    className={`conversation-avatar ${activeConversation.type === 'ORGANIZATION' ? 'org-avatar' : ''}`}
                    style={{ width: '38px', height: '38px' }}
                  >
                    {activeConversation.type === 'ORGANIZATION'
                      ? (activeConversation.organizationLogoUrl ? (
                          <img src={activeConversation.organizationLogoUrl} alt={activeConversation.organizationName} />
                        ) : (
                          (activeConversation.organizationName || 'O').slice(0, 2).toUpperCase()
                        ))
                      : (activeConversation.otherParticipant?.avatarUrl ? (
                          <img src={activeConversation.otherParticipant.avatarUrl} alt={activeConversation.otherParticipant.name} />
                        ) : (
                          (activeConversation.otherParticipant?.name || 'P').slice(0, 2).toUpperCase()
                        ))}
                  </div>

                  <div className="chat-participant-details">
                    <h3>
                      {activeConversation.type === 'ORGANIZATION'
                        ? activeConversation.organizationName
                        : activeConversation.otherParticipant?.name}
                    </h3>
                    <div className="chat-participant-meta">
                      {activeConversation.type === 'ORGANIZATION' ? (
                        <span>Organization Representative</span>
                      ) : (
                        <>
                          {activeConversation.otherParticipant?.uniquePlayerId && (
                            <span>{activeConversation.otherParticipant.uniquePlayerId}</span>
                          )}
                          {activeConversation.otherParticipant?.inGameName && (
                            <span>IGN: {activeConversation.otherParticipant.inGameName}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="chat-header-actions">
                  {activeConversation.type === 'ORGANIZATION' && activeConversation.organization_id && (
                    <Link
                      className="button secondary-button"
                      to={`/organization/${activeConversation.organization_id}`}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      View Organization
                    </Link>
                  )}
                  {activeConversation.type !== 'ORGANIZATION' && activeConversation.otherParticipant?.uniquePlayerId && (
                    <Link
                      className="button secondary-button"
                      to={`/player/${activeConversation.otherParticipant.uniquePlayerId}`}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      View Profile
                    </Link>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="chat-messages-container">
                {loadingChat && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Loading message history...
                  </div>
                )}

                {!loadingChat && messages.length === 0 && (
                  <div className="chat-empty-selection">
                    <p style={{ color: '#94a3b8', margin: 0 }}>
                      This is the beginning of your conversation with{' '}
                      <strong style={{ color: '#f6f8fb' }}>
                        {activeConversation.type === 'ORGANIZATION'
                          ? activeConversation.organizationName
                          : activeConversation.otherParticipant?.name}
                      </strong>
                      . Send a message to get started.
                    </p>
                  </div>
                )}

                {!loadingChat &&
                  messages.map((m) => {
                    const isMine = Number(m.senderId) === Number(identity?.id);
                    const formattedTime = new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={m.id}
                        className={`message-bubble-group ${isMine ? 'outgoing' : 'incoming'}`}
                      >
                        <div className="message-bubble">{m.message}</div>
                        <div className="message-meta">
                          <span>{formattedTime}</span>
                          {isMine && m.readAt && (
                            <span className="message-status-read">• Read</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="chat-input-bar">
                <form className="chat-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    maxLength={2000}
                    disabled={sending}
                  />
                  <button
                    className="chat-send-btn"
                    type="submit"
                    disabled={!messageText.trim() || sending}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="chat-empty-selection">
              <div className="chat-empty-icon">MSG</div>
              <strong style={{ fontSize: '1.1rem', color: '#f6f8fb', marginBottom: '0.5rem' }}>
                Select a conversation
              </strong>
              <p style={{ maxWidth: '380px', margin: 0, fontSize: '0.9rem' }}>
                Choose a conversation from the left to view messages, or start a new direct message from a player or organization profile.
              </p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
