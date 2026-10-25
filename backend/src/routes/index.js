// Central route registry: method + path -> file.
const authRoutes = require('./auth.routes');
const messengerRoutes = require('./messenger.routes');
const dashboardRoutes = require('./dashboard.routes');
const sleepRoutes = require('./sleep.routes');
const logsRoutes = require('./logs.routes');
const plansRoutes = require('./plans.routes');
const profileRoutes = require('./profile.routes');
const aiRoutes = require('./ai.routes');
const foodLogs = require('./foodLogs.routes');
const bmiRoutes = require('./bmi.routes');
const activityRoutes = require('./activity.routes');
const securityRoutes = require('./security.routes');
const notificationRoutes = require('./notification.routes');
const coachRoutes = require('./coach.routes');
const workoutLogRoutes = require('./workoutLogs.routes');
const forgotPasswordRoutes = require('./forgotpassword.routes');
const feedbackRoutes = require('./feedback.routes');
const statsRoutes = require('./stats.routes');

const goalsRoutes = require('./goals.routes');
const checkinsRoutes = require('./checkins.routes');
const nutrientGoalsRoutes = require('./nutrientGoals.routes');
const communityRoutes = require('./community.routes');
const settingsRoutes = require('./settings.routes');
const trainingPrefsRoutes = require('./trainingPrefs.routes');
const trainingInsightsRoutes = require('./trainingInsights.routes');
const progressRoutes = require('./progress.routes');
const adminRoutes = require('./admin.routes');
const publicRoutes = require('./public.routes');

const { requireMember } = require('../middleware/verifyUser');

function mountRoutes(app) {
  app.use('/api/public', publicRoutes); // no-auth aggregates (landing page)
  app.use('/api/goals', goalsRoutes);
  app.use('/api/checkins', checkinsRoutes);
  app.use('/api/nutrient-goals', nutrientGoalsRoutes);
  app.use('/api/community', requireMember, communityRoutes);
  app.use('/api/settings', settingsRoutes);
  // Module 5: training preferences (recommendation inputs) + rule-based insights.
  app.use('/api/training-preferences', requireMember, trainingPrefsRoutes);
  app.use('/api/training-insights', requireMember, trainingInsightsRoutes);
  // Module 6: progress photos (Gemini-analyzed), body measurements, activity analytics, export.
  app.use('/api/progress', progressRoutes);
  // Module 7: admin panel (backend only) — every route requires role='admin'.
  app.use('/api/admin', adminRoutes);
  app.use('/api/bmi', bmiRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', requireMember, messengerRoutes); // /contacts, /messages, /users/search, /friends
  app.use('/api', requireMember, dashboardRoutes); // /dashboard
  app.use('/api/sleep', requireMember, sleepRoutes);
  app.use('/api/logs', requireMember, logsRoutes);
  app.use('/api/plans', requireMember, plansRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api', requireMember, aiRoutes);
  app.use('/api/food-logs', requireMember, foodLogs);
  // Removed modules return 410 Gone for legacy clients.
  app.use('/api/clinic', (req, res) => res.status(410).json({ error: 'Virtual Clinic has been removed. Use AI Coach instead.', code: 'CLINIC_REMOVED' }));
  app.use('/api/atelier', (req, res) => res.status(410).json({ error: 'Atelier module has been removed.', code: 'ATELIER_REMOVED' }));
  app.use('/api/live-coaching', (req, res) => res.status(410).json({ error: 'Live Coaching page has been removed. Use Training workouts instead.', code: 'LIVE_COACHING_REMOVED' }));
  app.use('/api/workout-sessions', (req, res) => res.status(410).json({ error: 'Workout sessions endpoint has been removed. Use /api/workout-logs instead.', code: 'SESSIONS_REMOVED' }));
  app.use('/api/nutrition', (req, res) => res.status(410).json({ error: 'Nutrition endpoint has been removed. Use /api/food-logs instead.', code: 'NUTRITION_REMOVED' }));
  app.use('/api/activity', requireMember, activityRoutes);
  app.use('/api/security', securityRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/coach', requireMember, coachRoutes);
  app.use('/api/workout-logs', requireMember, workoutLogRoutes);
  app.use('/api/forgot-password', forgotPasswordRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/stats', requireMember, statsRoutes);

  // Debug helper - GET /api/_routes lists all mounted prefixes (non-prod only)
  app.get('/api/_routes', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      routes: [
        'GET  /api/health',
        'GET  /health',
        'GET  /api/readyz',
        'GET  /api/version',
        'GET  /api/_routes',
        'POST /api/auth/register | POST /api/auth/login | GET /api/auth/me | POST /api/auth/logout | POST /api/auth/google-login | POST /api/auth/change-password | PATCH /api/auth/change-email | POST /api/auth/send-verification | GET /api/auth/verify-email | POST /api/auth/complete-onboarding | GET /api/auth/allergies',
        'POST /api/auth/deactivate | POST /api/auth/reactivate (Module 1 account governance; requireAdmin middleware ready for Module 7)',
        'GET  /api/public/* (landing aggregates, no auth)',
        'GET|POST /api/bmi',
        'GET  /api/dashboard/:userId | GET /api/dashboard/week-calendar (current Mon–Sun) | GET /api/dashboard/calendar/:date (read-only day snapshot)',
        'GET|POST /api/sleep/*',
        'GET|POST /api/logs/*',
        'GET|POST|PUT|DELETE /api/plans/* (incl. POST /adjust-from-goal)',
        'GET|PUT /api/profile/*',
        'POST /api/analyze-pose | POST /api/ai/analysis | POST /api/ai/coach | GET /api/ai/history/:userId | GET /api/logs/latest/:userId | POST /api/ai/run-analysis | GET /api/ai/summary',
        'GET|POST|PUT|DELETE /api/food-logs/* (incl. POST /analyze-pic 10mb; GET /food-catalog?q= autocomplete)',
        'GET|POST|PUT|DELETE /api/activity/*',
        'GET|POST /api/goals/* | GET|POST /api/checkins/* | GET|PUT /api/nutrient-goals/*',
        'GET|POST|DELETE /api/community/*',
        'GET|PUT /api/settings',
        'GET|PUT /api/training-preferences (Module 5 recommendation inputs)',
        'GET  /api/training-insights (rule-based adaptive suggestions)',
        'GET /api/progress/activity | GET /api/progress/overview?range=30d|90d|1y|all | GET|POST|DELETE /api/progress/photos[(/:id/image|/:id/analyze)] | POST /api/progress/compare | GET|POST|DELETE /api/progress/measurements | GET /api/progress/export.csv | GET /api/progress/diary.txt (Module 6)',
        'GET /api/admin/overview | GET /api/admin/users[/:id] | POST /api/admin/users/:id/(role|status|signout) | DELETE /api/admin/users/:id | GET /api/admin/plans | GET|DELETE /api/admin/community/posts[/:id] | GET /api/admin/ai-usage | GET /api/admin/audit (Module 7, role=admin)',
        'GET|POST /api/security/*',
        'GET|POST /api/notifications/*',
        'GET|POST /api/coach/*',
        'GET|POST|PUT|DELETE /api/workout-logs/*',
        'POST /api/forgot-password/*',
        'GET|POST /api/feedback/*',
        'GET  /api/stats/*',
        'WS   /socket.io (messenger + dashboard rooms)',
        '410  /api/clinic | /api/atelier | /api/live-coaching | /api/workout-sessions | /api/nutrition (removed modules)',
      ],
    });
  });
}

module.exports = mountRoutes;
module.exports.mountRoutes = mountRoutes;
