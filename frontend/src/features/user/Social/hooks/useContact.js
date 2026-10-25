import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../../../../lib/apiClient.js';
import { useToastStore } from '../../../../stores/toastStore.js';

/**
 * Contacts, user search and the Facebook-style friend-request flow.
 *
 * - `contacts`  — accepted friends (used as the chat list)
 * - `requests`  — incoming pending friend requests
 * - `searchResults` — user search with the viewer's relationship folded in
 */
export const useContacts = (userId) => {
  const [contacts,      setContacts]      = useState([]);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState(null);
  const searchTermRef = useRef('');

  const updateSearchTerm = (value) => {
    searchTermRef.current = value;
    setSearchTerm(value);
    if (!String(value).trim()) setSearchResults([]);
  };

  const reloadContacts = useCallback(async () => {
    if (!userId) return;
    setContactsError(null);
    setLoadingContacts(true);
    try {
      const data = await apiGet(`/api/contacts/${userId}`);
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      setContactsError(err);
      if (import.meta.env.DEV) console.error('Error loading contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [userId]);

  const reloadRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiGet(`/api/friends/requests/${userId}`);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading friend requests:', err);
    }
  }, [userId]);

  useEffect(() => {
    reloadContacts();
    reloadRequests();
  }, [reloadContacts, reloadRequests]);

  // Debounced user search. Results carry relationship state so buttons can be
  // Add / Requested / Respond without extra calls.
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const term = searchTerm;
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet(
          `/api/users/search?query=${encodeURIComponent(term)}`
        );
        // Ignore stale responses if the user kept typing.
        if (searchTermRef.current !== term) return;
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Search error:', err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Send a friend request (does NOT start a chat). Notifies the recipient.
  const handleSendRequest = async (friendUser) => {
    setSearchResults((prev) => prev.map((u) => (
      u.id === friendUser.id ? { ...u, outgoing_status: 'pending' } : u
    )));
    try {
      const res = await apiPost('/api/friends/request', { friendId: friendUser.id });
      if (res?.status === 'accepted') {
        useToastStore.getState().addToast(`You are now friends with ${friendUser.name}.`, 'success');
        await reloadContacts();
      } else {
        useToastStore.getState().addToast(`Friend request sent to ${friendUser.name}.`, 'success');
      }
    } catch (err) {
      setSearchResults((prev) => prev.map((u) => (
        u.id === friendUser.id ? { ...u, outgoing_status: null } : u
      )));
      useToastStore.getState().addToast(err.message || 'Could not send friend request.', 'error');
    }
  };

  const handleAccept = async (requesterId) => {
    try {
      await apiPost('/api/friends/accept', { requesterId });
      setRequests((prev) => prev.filter((r) => r.id !== requesterId));
      await reloadContacts();
      useToastStore.getState().addToast('Friend request accepted.', 'success');
    } catch (err) {
      useToastStore.getState().addToast(err.message || 'Could not accept request.', 'error');
    }
  };

  const handleDecline = async (requesterId) => {
    try {
      await apiPost('/api/friends/decline', { requesterId });
      setRequests((prev) => prev.filter((r) => r.id !== requesterId));
    } catch (err) {
      useToastStore.getState().addToast(err.message || 'Could not decline request.', 'error');
    }
  };

  return {
    contacts,
    setContacts,
    searchTerm,
    setSearchTerm: updateSearchTerm,
    searchResults,
    requests,
    loadingContacts,
    handleSendRequest,
    handleAccept,
    handleDecline,
    contactsError,
    reloadContacts,
    reloadRequests,
  };
};