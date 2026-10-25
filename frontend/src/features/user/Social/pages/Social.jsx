import React, { useState, useRef, useEffect } from 'react';
import { BottomNav } from '../../../../components/index.js';
import AppShell from '../../../../components/AppShell.jsx';
import Icon from '../../../../components/Icon.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { useContacts } from '../hooks/useContact.js';
import { useMessages } from '../hooks/useMessages.js';
import { useNotificationStream } from '../../../../context/NotificationStream.jsx';
import { acquireSocket, releaseSocket, joinUserRoom } from '../../../../lib/socket.js';
import { resolveAvatar } from '../../../../lib/avatar.js';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import BrandLoader from '../../../../components/ui/BrandLoader.jsx';

const ContactAvatar = ({ name, avatarUrl, size = 'w-10 h-10' }) => {
  const [broken, setBroken] = React.useState(false);
  const a = resolveAvatar(avatarUrl, name);
  if (a.kind === 'image' && !broken) {
    return (
      <img
        className={`${size} rounded-full border border-[var(--border-light)] shrink-0 object-cover`}
        src={a.src}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-sm shrink-0`} style={{ background: a.surface.background, color: a.surface.color }}>
      {a.initials}
    </div>
  );
};

const OnlineDot = ({ online, size = 'w-2.5 h-2.5' }) => (
  <span className={`absolute bottom-0 right-0 ${size} rounded-full border-2 border-[var(--bg-secondary)] ${online ? 'bg-[var(--success)]' : 'bg-[var(--text-disabled)]'}`} />
);

// A user row's action depends on the relationship state returned by search.
const RelationshipAction = ({ user, onAdd, onAccept, onMessage }) => {
  const isFriend = ['accepted', 'close_friend'].includes(user.outgoing_status)
    || ['accepted', 'close_friend'].includes(user.incoming_status);
  if (isFriend) {
    return (
      <button onClick={() => onMessage(user)} className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-medium)] text-[length:var(--fs-12)] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0">
        Message
      </button>
    );
  }
  if (user.outgoing_status === 'pending') {
    return (
      <span className="h-9 px-3 inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-[length:var(--fs-12)] font-semibold text-[var(--text-muted)] shrink-0">
        <span className="material-symbols-outlined text-[length:var(--fs-16)]">schedule</span> Requested
      </span>
    );
  }
  if (user.incoming_status === 'pending') {
    return (
      <button onClick={() => onAccept(user.id)} className="h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold hover:bg-[var(--accent-dark)] transition-colors shrink-0">
        Accept
      </button>
    );
  }
  return (
    <button onClick={() => onAdd(user)} className="h-9 px-3 inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[length:var(--fs-12)] font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--text-inverse)] transition-colors shrink-0">
      <span className="material-symbols-outlined text-[length:var(--fs-16)]">person_add</span> Add
    </button>
  );
};

const VitalisMessenger = () => {
  const { user, loading } = useAuth();
  const userId = user?.id || null;
  const { subscribe } = useNotificationStream();

  const [activeContact,   setActiveContact]   = useState(null);
  const [showContactPanel, setShowContactPanel] = useState(true);

  const scrollRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = acquireSocket();
    return () => { releaseSocket(); socketRef.current = null; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    joinUserRoom(userId);
  }, [userId]);

  const {
    contacts,
    searchTerm,
    setSearchTerm,
    searchResults,
    requests,
    loadingContacts,
    handleSendRequest,
    handleAccept,
    handleDecline,
    contactsError,
    reloadContacts,
    reloadRequests,
  } = useContacts(userId);

  const {
    messages,
    inputValue,
    setInputValue,
    isSending,
    loadingMsgs,
    handleSendMessage,
  } = useMessages(userId, activeContact, socketRef);

  // Live: when a SOCIAL notification arrives (friend request / accept), refresh.
  useEffect(() => subscribe((n) => {
    if (String(n?.category || '').toUpperCase() === 'SOCIAL') {
      reloadRequests();
      reloadContacts();
    }
  }), [subscribe, reloadRequests, reloadContacts]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openChat = (contact) => { setActiveContact(contact); setShowContactPanel(false); };

  const acceptThenMaybeOpen = async (requesterId) => {
    await handleAccept(requesterId);
    const who = requests.find((r) => r.id === requesterId);
    if (who) openChat(who);
  };

  if (loading) return null;

  const contactRowCls = (isActive) => `w-full px-3 py-2.5 flex gap-3 items-center text-left transition-colors ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`;

  return (
    <AppShell
      userId={userId}
      mobileTitle="Messages"
      mainClassName="app-main--workbench"
      contentClassName="app-workbench"
      bottomNav={<BottomNav variant="biometrics" />}
    >
        {/* ── Contact sidebar ── */}
        <aside className={`border-r border-[var(--border-light)] bg-[var(--bg-secondary)] flex-col shrink-0 min-h-0 w-full md:w-72 lg:w-80 ${showContactPanel ? 'flex' : 'hidden'} md:flex`}>
          <div className="p-4 border-b border-[var(--border-light)]">
            <h2 className="text-[length:var(--fs-18)] font-extrabold tracking-tight font-[var(--font-display)]">Messages</h2>
            <div className="relative mt-3">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[length:var(--fs-20)] pointer-events-none text-[var(--text-disabled)]">search</span>
              <input
                type="text"
                placeholder="Search people to add…"
                aria-label="Search users"
                className="w-full h-10 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[var(--radius-md)] pl-10 pr-3 text-[length:var(--fs-13)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-grow overflow-y-auto no-scrollbar py-2">
            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="pb-2 mb-2 border-b border-[var(--border-light)]">
                <p className="px-4 py-2 text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Search results</p>
                {searchResults.map(u => (
                  <div key={u.id} className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <ContactAvatar name={u.name} avatarUrl={u.avatar_url} size="w-9 h-9" />
                      <span className="text-[length:var(--fs-13)] font-medium truncate text-[var(--text-primary)]">{u.name}</span>
                    </div>
                    <RelationshipAction user={u} onAdd={handleSendRequest} onAccept={acceptThenMaybeOpen} onMessage={openChat} />
                  </div>
                ))}
              </div>
            )}

            {/* Friend requests */}
            {requests.length > 0 && (
              <div className="pb-2 mb-2 border-b border-[var(--border-light)]">
                <p className="px-4 py-2 flex items-center gap-2 text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Friend requests
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-10)] font-black">{requests.length}</span>
                </p>
                {requests.map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors">
                    <ContactAvatar name={r.name} avatarUrl={r.avatar_url} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--fs-13)] font-semibold truncate text-[var(--text-primary)]">{r.name}</p>
                      <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">wants to connect</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => acceptThenMaybeOpen(r.id)} aria-label={`Accept ${r.name}`}
                        className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center hover:bg-[var(--accent-dark)] transition-colors">
                        <span className="material-symbols-outlined text-[length:var(--fs-18)]">check</span>
                      </button>
                      <button onClick={() => handleDecline(r.id)} aria-label={`Decline ${r.name}`}
                        className="w-9 h-9 rounded-full border border-[var(--border-medium)] text-[var(--text-muted)] flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors">
                        <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="px-4 py-2 text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Conversations</p>

            {contactsError && contacts.length === 0 && (
              <div className="px-4 py-2"><ErrorState message={contactsError.message || 'Could not load contacts.'} onRetry={reloadContacts} /></div>
            )}

            {loadingContacts && contacts.length === 0 ? (
              <div className="px-4 py-6 flex justify-center"><BrandLoader size="sm" /></div>
            ) : contacts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <span className="material-symbols-outlined text-[length:var(--fs-32)] text-[var(--text-disabled)]">group</span>
                <p className="mt-1 text-[length:var(--fs-12)] text-[var(--text-muted)]">No friends yet. Search above to add someone.</p>
              </div>
            ) : (
              contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => openChat(contact)}
                  aria-current={activeContact?.id === contact.id ? 'true' : undefined}
                  className={contactRowCls(activeContact?.id === contact.id)}
                >
                  <div className="relative shrink-0">
                    <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} />
                    <OnlineDot online={contact.is_online} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[length:var(--fs-13)] font-bold truncate text-[var(--text-primary)]">{contact.name}</h3>
                    <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] truncate">{contact.is_online ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <section className={`flex-grow flex-col bg-[var(--bg-primary)] min-w-0 min-h-0 ${!showContactPanel ? 'flex' : 'hidden'} md:flex`}>
          {activeContact ? (
            <>
              <header className="h-16 px-4 sm:px-6 flex items-center border-b border-[var(--border-light)] gap-3 shrink-0 bg-[var(--bg-secondary)]">
                <button
                  className="md:hidden w-10 h-10 -ml-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
                  onClick={() => setShowContactPanel(true)}
                  aria-label="Back to conversations"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <ContactAvatar name={activeContact.name} avatarUrl={activeContact.avatar_url} size="w-10 h-10" />
                <div className="min-w-0">
                  <h1 className="text-[length:var(--fs-15)] font-bold truncate text-[var(--text-primary)]">{activeContact.name}</h1>
                  <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] truncate">
                    {activeContact.is_online ? <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] inline-block" />Online</span> : 'Offline'}
                  </p>
                </div>
              </header>

              <div ref={scrollRef} className="flex-grow overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-5 no-scrollbar">
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-5">
                  {loadingMsgs ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-12" role="status" aria-busy="true">
                      <BrandLoader size="sm" message="Loading messages…" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)]">
                      <span className="material-symbols-outlined text-[length:var(--fs-40)] text-[var(--text-disabled)]">chat_bubble</span>
                      <p className="text-[length:var(--fs-13)] mt-2">No messages yet — say hello to {activeContact.name}.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={msg.id || idx} className={`flex flex-col gap-1 w-full max-w-[85%] sm:max-w-md ${msg.isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-[length:var(--fs-14)] leading-relaxed break-words w-full ${msg.isMe ? `bg-[var(--accent)] text-[var(--text-inverse)] rounded-br-md${msg.failed ? ' opacity-50' : ''}` : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-bl-md'}`}>
                          {msg.content}
                          {msg.failed && <span className="ml-2 text-[length:var(--fs-11)] font-semibold">· Failed to send</span>}
                        </div>
                        <span className="text-[length:var(--fs-10)] text-[var(--text-muted)] px-1">{msg.time}</span>
                      </div>
                    ))
                  )}

                </div>
              </div>

              <footer className="px-3 pb-20 pt-3 md:p-5 md:pb-5 shrink-0 bg-[var(--bg-secondary)] border-t border-[var(--border-light)]">
                <div className="w-full max-w-3xl mx-auto bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[var(--radius-lg)] p-1.5 flex items-end gap-2 transition-colors focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent)]/10">
                  <textarea
                    aria-label={`Message ${activeContact.name}`}
                    className="flex-grow bg-transparent border-none outline-none text-[length:var(--fs-14)] text-[var(--text-primary)] p-2 resize-none max-h-32 no-scrollbar placeholder:text-[var(--text-disabled)] disabled:opacity-50"
                    placeholder={isSending ? 'Sending…' : `Message ${activeContact.name}…`}
                    rows={1}
                    value={inputValue}
                    disabled={isSending}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    aria-label="Send message"
                    className="bg-[var(--accent)] text-[var(--text-inverse)] w-10 h-10 rounded-[var(--radius-md)] disabled:opacity-40 active:scale-95 transition-all shrink-0 hover:bg-[var(--accent-dark)] flex items-center justify-center"
                    disabled={!inputValue.trim() || isSending}
                  >
                    {isSending
                      ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" aria-hidden="true" />
                      : <Icon name="send" weight={600} />}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
              <span className="material-symbols-outlined text-[length:var(--fs-56)] text-[var(--text-disabled)]">forum</span>
              <p className="text-[length:var(--fs-14)] font-medium text-center px-4">Select a conversation to start chatting.</p>
            </div>
          )}
        </section>
    </AppShell>
  );
};

export default VitalisMessenger;