const messengerService = require('../services/messenger.service');
const notificationController = require('./notification.controller');
const { validId } = require('../utils/ids');

async function getcontactsUserId(req, res, next) {
  try {
    const userId = validId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    if (userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    try {
      const rows = await messengerService.getContacts(userId);
      res.json(rows);
    } catch (err) {
      console.error('Contacts Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function getmessagesUserIdContactId(req, res, next) {
  try {
    const userId = validId(req.params.userId);
    const contactId = validId(req.params.contactId);
    if (!userId || !contactId) return res.status(400).json({ error: 'Invalid user or contact id' });
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const beforeRaw = req.query.before;
    let before = null;
    let beforeValid = false;
    if (beforeRaw !== undefined && beforeRaw !== null && beforeRaw !== '') {
      before = new Date(beforeRaw);
      beforeValid = before instanceof Date && !isNaN(before);
      if (!beforeValid)
        return res.status(400).json({ error: 'Invalid before date (must be ISO datetime)' });
    }
    try {
      const rows = await messengerService.getMessagesBetween(userId, contactId, {
        limit,
        before,
        beforeValid,
      });
      res.json(rows);
    } catch (err) {
      console.error('History Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postmessages(req, res, next) {
  try {
    const sender_id = validId(req.body?.sender_id);
    const receiver_id = validId(req.body?.receiver_id);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!sender_id || !receiver_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }
    // Sender must be the logged-in user — prevents impersonation
    if (sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const row = await messengerService.createMessage(sender_id, receiver_id, content);
      if (!row) return res.status(404).json({ error: 'Recipient not found' });

      // Message notification — same pattern as friend requests (SOCIAL, SSE fan-out).
      // Fail-soft: a notification hiccup must never fail the send itself.
      if (receiver_id !== sender_id) {
        try {
          const senderName = await messengerService.getDisplayName(sender_id);
          const preview = content.length > 60 ? `${content.slice(0, 60).trimEnd()}…` : content;
          await notificationController.notifyUser(receiver_id, {
            message: `${senderName}: ${preview}`,
            type: 'info',
            category: 'SOCIAL',
          });
        } catch (notifErr) {
          console.error('Message notification Error:', notifErr.message);
        }
      }

      res.status(201).json(row);
    } catch (err) {
      console.error('Send Message Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function getusersSearch(req, res, next) {
  try {
    const rawQuery = typeof req.query?.query === 'string' ? req.query.query.trim() : '';
    if (!rawQuery) return res.json([]);
    if (rawQuery.length > 50)
      return res.status(400).json({ error: 'Search too long (max 50 chars)' });
    try {
      const rows = await messengerService.searchUsers(rawQuery, req.user.id);
      res.json(rows);
    } catch (err) {
      console.error('Search Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postfriendsAdd(req, res, next) {
  try {
    const userId = validId(req.body?.userId);
    const friendId = validId(req.body?.friendId);
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Missing userId or friendId' });
    }
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }
    try {
      const added = await messengerService.addFriend(userId, friendId);
      if (!added) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, message: 'Added to Close Friends' });
    } catch (err) {
      console.error('Add Friend Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// ─── FRIENDSHIPS ───────────────────────────────────────────────────────────
// Send a friend request and notify the recipient (like Facebook/Messenger).
async function postfriendsRequest(req, res, next) {
  try {
    const friendId = validId(req.body?.friendId);
    if (!friendId) return res.status(400).json({ error: 'Missing friendId' });
    if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    try {
      const result = await messengerService.sendFriendRequest(req.user.id, friendId);
      if (!result.ok) return res.status(404).json({ error: 'User not found' });

      if (result.status === 'pending') {
        await notificationController.notifyUser(friendId, {
          message: `${result.requesterName || 'Someone'} sent you a friend request`,
          type: 'info',
          category: 'SOCIAL',
        });
      } else if (result.status === 'accepted') {
        // Mutual request → auto-accepted. Let the other person know.
        await notificationController.notifyUser(friendId, {
          message: `You are now friends with ${result.requesterName || 'someone'}`,
          type: 'success',
          category: 'SOCIAL',
        });
      }
      res.json({ success: true, status: result.status });
    } catch (err) {
      console.error('Friend Request Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function getfriendsRequests(req, res, next) {
  try {
    const userId = validId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    if (userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    try {
      const rows = await messengerService.getIncomingRequests(userId);
      res.json(rows);
    } catch (err) {
      console.error('Friend Requests Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postfriendsAccept(req, res, next) {
  try {
    const requesterId = validId(req.body?.requesterId);
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });
    try {
      const ok = await messengerService.acceptFriendRequest(req.user.id, requesterId);
      if (!ok) return res.status(404).json({ error: 'Request not found' });
      const [[me]] = await (require('../config/db')).execute(
        'SELECT name FROM users WHERE id = ? LIMIT 1', [req.user.id]
      );
      await notificationController.notifyUser(requesterId, {
        message: `${me?.name || 'Someone'} accepted your friend request`,
        type: 'success',
        category: 'SOCIAL',
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Accept Friend Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postfriendsDecline(req, res, next) {
  try {
    const requesterId = validId(req.body?.requesterId);
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });
    try {
      const ok = await messengerService.declineFriendRequest(req.user.id, requesterId);
      res.json({ success: true, removed: ok });
    } catch (err) {
      console.error('Decline Friend Error:', err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function getfriendsStatus(req, res, next) {
  try {
    const friendId = validId(req.query?.friendId);
    if (!friendId) return res.status(400).json({ error: 'Missing friendId' });
    try {
      const status = await messengerService.getFriendStatus(req.user.id, friendId);
      res.json({ status });
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getcontactsUserId,
  getmessagesUserIdContactId,
  postmessages,
  getusersSearch,
  postfriendsAdd,
  postfriendsRequest,
  getfriendsRequests,
  postfriendsAccept,
  postfriendsDecline,
  getfriendsStatus,
};
