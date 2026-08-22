import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChat } from '../services/communicationApi.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function GroupChatView({ groupId, groupName, isCompleted = false }) {
  const { identity } = useAuth();
  const { joinGroup, leaveGroup, on, sendMessage, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [state, setState] = useState({ loading: true, error: '', sending: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!groupId) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const result = await fetchChat(groupId);
      setMessages(result.messages || []);
      setState((s) => ({ ...s, loading: false }));
      // Scroll to bottom after initial load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    } catch (error) {
      setState({ loading: false, error: error.message, sending: false });
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    joinGroup(groupId);
    loadHistory();

    const removeListener = on('chat_message', (incoming) => {
      if (String(incoming.groupId) === String(groupId)) {
        setMessages((current) => {
          if (current.some((m) => m.id === incoming.id)) return current;
          return [...current, incoming];
        });

        // If user is scrolled up, show unread count; otherwise autoscroll
        if (scrollContainerRef.current) {
          const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
          const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
          if (distanceFromBottom > 100) {
            setUnreadCount((c) => c + 1);
          } else {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }
        }
      }
    });

    return () => {
      leaveGroup(groupId);
      removeListener();
    };
  }, [groupId, joinGroup, leaveGroup, loadHistory, on]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight <= 60;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || state.sending || isCompleted) return;

    const textToSend = inputText.trim();
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      await sendMessage({ groupId, message: textToSend });
      setInputText('');
      setState((s) => ({ ...s, sending: false }));
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (error) {
      setState((s) => ({ ...s, sending: false, error: error.message }));
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="esports-chat-container">
      {/* Chat Header */}
      <div className="esports-chat-header">
        <div className="chat-header-info">
          <div className="chat-title-row">
            <span className="live-dot" style={{ background: connected ? '#2ecc71' : '#e74c3c' }} />
            <h3>{groupName ? `${groupName} Chat` : 'Group Chat'}</h3>
          </div>
          <p className="chat-header-desc">
            Live group communication · Encrypted & isolated to this group
          </p>
        </div>
        <div className="chat-status-pill">
          {connected ? '● LIVE' : '○ OFFLINE'}
        </div>
      </div>

      {/* Error alert */}
      {state.error && (
        <div className="form-alert" role="alert" style={{ margin: '8px 12px' }}>
          {state.error}
        </div>
      )}

      {/* Message List */}
      <div
        className="esports-chat-messages"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {state.loading && (
          <div className="chat-loading-state">
            <p className="status-panel">Loading conversation history...</p>
          </div>
        )}

        {!state.loading && messages.length === 0 && (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <h4>No messages in this group yet</h4>
            <p>Coordinate strategies, room joining, and match details with your group participants.</p>
          </div>
        )}

        {!state.loading &&
          messages.map((msg, idx) => {
            const isMe = identity?.id === msg.senderId;
            const isPrevSameSender =
              idx > 0 && messages[idx - 1].senderId === msg.senderId;

            return (
              <div
                key={msg.id || idx}
                className={`chat-message-row ${isMe ? 'is-self' : 'is-other'} ${isPrevSameSender ? 'is-consecutive' : ''}`}
              >
                {!isMe && !isPrevSameSender && (
                  <div className="chat-avatar" title={msg.senderName}>
                    {getInitials(msg.senderName)}
                  </div>
                )}
                {!isMe && isPrevSameSender && <div className="chat-avatar-spacer" />}

                <div className="chat-bubble-wrapper">
                  {!isPrevSameSender && (
                    <div className="chat-sender-header">
                      <span className="chat-sender-name">
                        {msg.senderName}
                        {msg.senderRole === 'ORGANIZER' && (
                          <span className="organizer-badge">ORGANIZER</span>
                        )}
                      </span>
                      <span className="chat-timestamp">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className="chat-bubble">
                    <p>{msg.message}</p>
                    {isPrevSameSender && (
                      <span className="chat-inline-time">{formatTime(msg.createdAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating unread / scroll to bottom button */}
      {!isAtBottom && unreadCount > 0 && (
        <button
          className="chat-unread-badge-btn"
          type="button"
          onClick={scrollToBottom}
        >
          ↓ {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
        </button>
      )}

      {/* Chat Composer */}
      <div className="esports-chat-composer">
        {isCompleted ? (
          <div className="chat-readonly-banner">
            🔒 Tournament completed. Group chat is closed and archived.
          </div>
        ) : (
          <form className="chat-input-form" onSubmit={handleSend}>
            <input
              type="text"
              className="chat-input-field"
              placeholder="Send message to group..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={state.sending}
              maxLength={1000}
            />
            <button
              className="button primary-button chat-send-btn"
              type="submit"
              disabled={!inputText.trim() || state.sending}
            >
              {state.sending ? '...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
