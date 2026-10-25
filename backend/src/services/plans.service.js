// Plans — business logic + DB access. Controllers stay thin (parse/validate,
// call here, shape the response). All SQL lives in this file.
const db = require('../config/db');
const { AppError } = require('../utils/errors');

// Bodyweight starter sets per plan focus (equipment: none).
// Recovery days intentionally get zero exercises (tracker offers Mark Complete).
const STARTER_BY_TAG = {
    Strength: [
        { exercise_order: 1, exercise_name: 'Bodyweight Squats', sets: 3, reps: '12', duration_seconds: null, rest_seconds: 60, notes: null },
        { exercise_order: 2, exercise_name: 'Push-Ups', sets: 3, reps: '10', duration_seconds: null, rest_seconds: 60, notes: 'Knees down to scale' },
        { exercise_order: 3, exercise_name: 'Plank', sets: 3, reps: null, duration_seconds: 30, rest_seconds: 45, notes: null },
        { exercise_order: 4, exercise_name: 'Glute Bridge', sets: 2, reps: '15', duration_seconds: null, rest_seconds: 45, notes: 'Squeeze at the top' },
    ],
    Cardio: [
        { exercise_order: 1, exercise_name: 'Jumping Jacks', sets: 3, reps: null, duration_seconds: 45, rest_seconds: 30, notes: null },
        { exercise_order: 2, exercise_name: 'High Knees', sets: 3, reps: null, duration_seconds: 30, rest_seconds: 30, notes: null },
        { exercise_order: 3, exercise_name: 'Mountain Climbers', sets: 3, reps: null, duration_seconds: 30, rest_seconds: 30, notes: 'Keep hips low' },
        { exercise_order: 4, exercise_name: 'Skaters', sets: 3, reps: null, duration_seconds: 30, rest_seconds: 30, notes: null },
    ],
    Mobility: [
        { exercise_order: 1, exercise_name: 'Cat-Cow', sets: 2, reps: null, duration_seconds: 60, rest_seconds: 20, notes: 'Move with your breath' },
        { exercise_order: 2, exercise_name: "Child's Pose Hold", sets: 2, reps: null, duration_seconds: 45, rest_seconds: 20, notes: null },
        { exercise_order: 3, exercise_name: 'Hip Circles', sets: 2, reps: '10 each side', duration_seconds: null, rest_seconds: 20, notes: null },
        { exercise_order: 4, exercise_name: 'Deep Breathing', sets: 1, reps: null, duration_seconds: 60, rest_seconds: null, notes: 'Nose in, slow mouth out' },
    ],
    Performance: [
        { exercise_order: 1, exercise_name: 'Jump Squats', sets: 4, reps: '8', duration_seconds: null, rest_seconds: 60, notes: 'Land soft' },
        { exercise_order: 2, exercise_name: 'Walking Lunges', sets: 3, reps: '10 each leg', duration_seconds: null, rest_seconds: 60, notes: null },
        { exercise_order: 3, exercise_name: 'Plank Shoulder Taps', sets: 3, reps: '12', duration_seconds: null, rest_seconds: 45, notes: 'Hips still' },
        { exercise_order: 4, exercise_name: 'Superman Hold', sets: 3, reps: null, duration_seconds: 30, rest_seconds: 45, notes: null },
    ],
};

// Fat Loss trains like cardio; Flexibility like mobility; anything else gets the balanced set.
function starterForTag(tag) {
    if (tag === 'Fat Loss' || tag === 'Cardio') return STARTER_BY_TAG.Cardio;
    if (tag === 'Flexibility' || tag === 'Mobility' || tag === 'Recovery') return STARTER_BY_TAG.Mobility;
    if (tag === 'Performance') return STARTER_BY_TAG.Performance;
    return STARTER_BY_TAG.Strength;
}

function humanizeGoal(goalType) {
    return String(goalType || 'Fitness').toLowerCase().split('_').map((w) => w.slice(0, 1).toUpperCase() + w.slice(1)).join(' ');
}

function tagForGoal(goalType) {
    if (goalType === 'LOSE_WEIGHT') return 'Fat Loss';
    if (goalType === 'BUILD_MUSCLE' || goalType === 'GAIN_WEIGHT') return 'Strength';
    if (goalType === 'PERFORMANCE') return 'Performance';
    return 'General';
}

function skeletonDays(durationDays, minutes) {
    const trainMins = minutes ? minutes.train : 30;
    const restMins = minutes ? minutes.rest : 15;
    const days = [];
    for (let n = 1; n <= durationDays; n += 1) {
        const recovery = n % 3 === 0;
        days.push({
            day_number: n,
            title: recovery ? `Day ${n} — Recovery` : `Day ${n} — Training`,
            activity_type: recovery ? 'Recovery' : 'Workout',
            description: recovery
                ? 'Mobility + light walk. Keep it easy.'
                : 'Main session. Warm up, train, cool down.',
            duration_mins: recovery ? restMins : trainMins,
        });
    }
    return days;
}

// Insert a personal plan + its day skeleton + focus-matched starter exercises.
// Runs inside the caller's transaction (conn), so a failure rolls everything back.
// dayMins: preferred session length from training_preferences (Module 5) —
// sizes each training day; recovery days get half. null keeps the default 30.
async function insertPersonalPlan(conn, userId, { title, tag, intensity, targetFocus, durationDays, description, imageSeed, dayMins }) {
    const [[dup]] = await conn.execute(
        'SELECT id FROM plans WHERE owner_user_id = ? AND title = ? LIMIT 1',
        [userId, title]
    );
    if (dup) {
        throw new AppError('You already have a plan with this title', 409, 'PLAN_TITLE_DUP');
    }
    let planId;
    try {
        const [result] = await conn.execute(
            `INSERT INTO plans (name, title, tag, intensity, duration, target_focus, price, image_seed, description, duration_days, difficulty, owner_user_id, is_template)
             VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, 0)`,
            [title, title, tag, intensity, `${durationDays} days`, targetFocus, imageSeed || 'personal', description, durationDays, intensity, userId]
        );
        planId = result.insertId;
    } catch (e) {
        // Pre-032 database (no owner columns) — tell client to migrate instead of 500.
        if (e && (e.errno === 1054 || /Unknown column 'owner_user_id'|Unknown column 'is_template'/.test(e.message || ''))) {
            throw new AppError('Personal plans need migration 032 — run npm run db:migrate', 503, 'NEEDS_MIGRATION_032');
        }
        if (e && e.code === 'ER_DUP_ENTRY') {
            throw new AppError('Plan title already taken — try another title', 409, 'PLAN_TITLE_DUP');
        }
        throw e;
    }
    const minutes = dayMins != null ? { train: Math.max(15, Math.min(180, Math.round(dayMins))), rest: Math.max(10, Math.round((Math.min(180, dayMins)) / 2)) } : null;
    for (const d of skeletonDays(durationDays, minutes)) {
        const [contentResult] = await conn.execute(
            `INSERT INTO plan_contents (plan_id, day_number, title, activity_type, description, duration_mins)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [planId, d.day_number, d.title, d.activity_type, d.description, d.duration_mins]
        );
        // Workout days get the focus-matched starter set; recovery days stay empty.
        if (d.activity_type === 'Workout' && contentResult && contentResult.insertId) {
            for (const ex of starterForTag(tag)) {
                await conn.execute(
                    `INSERT INTO plan_exercises (plan_content_id, exercise_order, exercise_name, sets, reps, duration_seconds, rest_seconds, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [contentResult.insertId, ex.exercise_order, ex.exercise_name, ex.sets, ex.reps, ex.duration_seconds, ex.rest_seconds, ex.notes]
                );
            }
        }
    }
    await conn.execute(
        'INSERT IGNORE INTO user_plans (user_id, plan_id, enrolled_at) VALUES (?, ?, NOW())',
        [userId, planId]
    );
    return planId;
}

// Enroll in a marketplace template. Identity comes from JWT (userId), never body.
async function enroll(userId, planId) {
    // 404 (not 500 FK) when plan doesn't exist
    const [[plan]] = await db.execute('SELECT id FROM plans WHERE id = ? LIMIT 1', [planId]);
    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    try {
        await db.execute(
            `INSERT INTO user_plans (user_id, plan_id, enrolled_at) VALUES (?, ?, NOW())`,
            [userId, planId]
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new AppError('You already own this blueprint', 409, 'ALREADY_ENROLLED');
        throw err;
    }
}

async function completeProgress(userId, planId, dayNumber) {
    // 404 (not 500 FK) when plan doesn't exist; 409 when not enrolled.
    const [[plan]] = await db.execute('SELECT id FROM plans WHERE id = ? LIMIT 1', [planId]);
    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    const [[enrolled]] = await db.execute(
        'SELECT id FROM user_plans WHERE user_id = ? AND plan_id = ? LIMIT 1',
        [userId, planId]
    );
    if (!enrolled) throw new AppError('Enroll in this plan first', 409, 'NOT_ENROLLED');
    await db.execute(
        `INSERT INTO user_plan_progress (user_id, plan_id, day_number, is_completed, completed_at)
         VALUES (?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE is_completed = 1, completed_at = NOW()`,
        [userId, planId, dayNumber]
    );
}

async function getProgress(userId, planId) {
    const [rows] = await db.execute(
        'SELECT day_number, is_completed FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
        [userId, planId]
    );
    return rows;
}

async function getPlanContent(planId) {
    const [[plan]] = await db.execute('SELECT id FROM plans WHERE id = ? LIMIT 1', [planId]);
    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    const [days] = await db.execute(
        `SELECT id, day_number, title, activity_type, description, duration_mins
         FROM plan_contents WHERE plan_id = ? ORDER BY day_number ASC`,
        [planId]
    );

    if (days.length === 0) {
        throw new AppError('Plan not found or has no content', 404, 'PLAN_NOT_FOUND');
    }

    const dayIds = days.map(d => d.id);
    const placeholders = dayIds.map(() => '?').join(',');
    const [exerciseRows] = await db.execute(
        `SELECT plan_content_id, exercise_order, exercise_name, sets, reps, duration_seconds, rest_seconds, notes
         FROM plan_exercises
         WHERE plan_content_id IN (${placeholders})
         ORDER BY plan_content_id ASC, exercise_order ASC`,
        dayIds
    );

    const exercisesByDay = {};
    for (const ex of exerciseRows) {
        if (!exercisesByDay[ex.plan_content_id]) exercisesByDay[ex.plan_content_id] = [];
        exercisesByDay[ex.plan_content_id].push({
            order: ex.exercise_order,
            name: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            durationSeconds: ex.duration_seconds,
            restSeconds: ex.rest_seconds,
            notes: ex.notes,
        });
    }

    return days.map(day => ({
        ...day,
        exercises: exercisesByDay[day.id] || [],
    }));
}

async function getPlansForUser(userId) {
    const [rows] = await db.execute(
        `SELECT p.*, IF(up.user_id IS NULL, 0, 1) as is_enrolled
         FROM plans p
         LEFT JOIN user_plans up ON p.id = up.plan_id AND up.user_id = ?
         ORDER BY p.id ASC`,
        [userId]
    );
    // Per-plan completed-day counts (separate query so list works even
    // when 032 columns/progress table differ pre-migration).
    let doneByPlan = {};
    try {
        const [counts] = await db.execute(
            `SELECT plan_id, COUNT(*) AS done FROM user_plan_progress
             WHERE user_id = ? AND is_completed = 1 GROUP BY plan_id`,
            [userId]
        );
        for (const r of counts) doneByPlan[r.plan_id] = Number(r.done || 0);
    } catch { doneByPlan = {}; }
    return rows.map((p) => {
        const total = Number(p.duration_days || 0);
        const done = Number(doneByPlan[p.id] || 0);
        const ownerId = p.owner_user_id ?? null;
        return {
            ...p,
            owner_user_id: ownerId,
            // Pre-032 rows have no is_template column → treat as template.
            is_template: p.is_template ?? 1,
            is_owner: ownerId != null && String(ownerId) === String(userId) ? 1 : 0,
            completed_days: done,
            progress_pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
        };
    });
}

// Create a personal plan (transaction: plan + contents + exercises + enroll).
async function createPersonalPlan(userId, { title, tag, intensity, targetFocus, durationDays, description }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const planId = await insertPersonalPlan(conn, userId, {
            title, tag, intensity, targetFocus, durationDays, description,
        });
        await conn.query('COMMIT');
        return { planId };
    } catch (err) {
        try { await conn.query('ROLLBACK'); } catch { /* noop */ }
        throw err;
    } finally {
        try { conn.release(); } catch { /* noop */ }
    }
}

async function updatePersonalPlan(userId, planId, body) {
    const [[plan]] = await db.execute('SELECT id, owner_user_id FROM plans WHERE id = ? LIMIT 1', [planId]);
    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    if (plan.owner_user_id == null || String(plan.owner_user_id) !== String(userId)) {
        throw new AppError('Only the owner can edit this plan', 403, 'FORBIDDEN');
    }
    const patch = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.tag !== undefined) patch.tag = body.tag;
    if (body.intensity !== undefined) patch.intensity = body.intensity;
    if (body.targetFocus !== undefined) patch.target_focus = body.targetFocus;
    if (body.description !== undefined) patch.description = body.description;
    if (body.durationDays !== undefined) patch.duration_days = body.durationDays;
    if (body.title !== undefined) patch.name = body.title;
    const keys = Object.keys(patch);
    if (keys.length === 0) throw new AppError('Nothing to update', 400, 'NOTHING_TO_UPDATE');
    try {
        await db.execute(
            `UPDATE plans SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')} WHERE id = ?`,
            [...keys.map((k) => patch[k]), planId]
        );
    } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') throw new AppError('Plan title already taken — try another title', 409, 'PLAN_TITLE_DUP');
        throw e;
    }
}

async function deletePersonalPlan(userId, planId) {
    const [[plan]] = await db.execute('SELECT id, owner_user_id FROM plans WHERE id = ? LIMIT 1', [planId]);
    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    if (plan.owner_user_id == null || String(plan.owner_user_id) !== String(userId)) {
        throw new AppError('Only the owner can delete this plan', 403, 'FORBIDDEN');
    }
    await db.execute('DELETE FROM plans WHERE id = ?', [planId]);
}

// Auto-generate (or reuse) a 7-day starter plan from the active fitness goal.
// Module 5: respects training_preferences when present — day length comes from
// the saved session minutes and equipment/location are described in the plan
// (starter exercises stay bodyweight-only; alternatives handle equipment).
async function autoCreateFromGoal(userId) {
    const [[goal]] = await db.execute(
        `SELECT id, goal_type, daily_kcal, protein_g, carbs_g, fat_g, activity_level
         FROM fitness_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [userId]
    );
    if (!goal) throw new AppError('No active goal — complete onboarding first', 404, 'NO_ACTIVE_GOAL');

    // Best-effort prefs — a missing/old schema must never block generation.
    let prefs = null;
    try {
        const trainingPrefs = require('./trainingPrefs.service');
        prefs = await trainingPrefs.get(userId);
    } catch { prefs = null; }
    const dayMins = prefs?.sessionDurationMins ?? null;
    const equipNote = prefs && Array.isArray(prefs.equipment) && prefs.equipment.length > 0
        ? ` · using your ${prefs.equipment.join(', ')}` : '';

    const label = humanizeGoal(goal.goal_type);
    const title = `My ${label} Plan`;
    const kcal = goal.daily_kcal != null ? `${Number(goal.daily_kcal).toLocaleString()} kcal/day` : 'balanced nutrition';
    const macros = (goal.protein_g != null && goal.carbs_g != null && goal.fat_g != null)
        ? ` (P${goal.protein_g}g C${goal.carbs_g}g F${goal.fat_g}g)` : '';
    const tag = tagForGoal(goal.goal_type);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[existing]] = await conn.execute(
            'SELECT id FROM plans WHERE owner_user_id = ? AND title = ? LIMIT 1',
            [userId, title]
        );
        let planId;
        let created = true;
        if (existing) {
            planId = existing.id;
            created = false;
            try {
                await conn.execute(
                    'UPDATE plans SET tag = ?, target_focus = ?, duration_days = 7 WHERE id = ?',
                    [tag, tag === 'General' ? 'General' : tag, planId]
                );
            } catch { /* pre-032 or no-op — still enroll below */ }
        } else {
            planId = await insertPersonalPlan(conn, userId, {
                title,
                tag,
                intensity: 'Moderate',
                targetFocus: tag,
                durationDays: 7,
                description: `Auto-generated from your ${label} goal — ${kcal}${macros}. 7-day starter: alternate training + recovery${dayMins ? ` · ${dayMins} min days` : ''}${equipNote}; edit anytime.`,
                imageSeed: 'personal-goal',
                dayMins,
            });
        }
        await conn.execute(
            'INSERT IGNORE INTO user_plans (user_id, plan_id, enrolled_at) VALUES (?, ?, NOW())',
            [userId, planId]
        );
        // Link back to goal when 032 has run; ignore when column missing.
        try {
            await conn.execute('UPDATE fitness_goals SET source_plan_id = ? WHERE id = ?', [planId, goal.id]);
        } catch { /* pre-032 — non-fatal */ }
        await conn.query('COMMIT');
        return { planId, created };
    } catch (err) {
        try { await conn.query('ROLLBACK'); } catch { /* noop */ }
        throw err;
    } finally {
        try { conn.release(); } catch { /* noop */ }
    }
}

// ── Module 5: one-click adaptive adjustment ───────────────────────────────────
// mode 'shorter': cap every training day at ≤30 mins (schedules, never auto-
// load). mode 'gentle': +1 set per rep exercise (≤5), +10s holds (≤120),
// +10s rest (≤120). Only the user can trigger these — the engine never
// increases intensity on its own.

const ADJUST_NOTES = {
    shorter: 'Adapted: fit to ≤30 min sessions',
    gentle: 'Adapted: +1 set / slightly longer holds',
};

async function adjustLinkedPlan(userId, mode) {
    if (!ADJUST_NOTES[mode]) {
        throw new AppError("mode must be 'shorter' or 'gentle'", 400, 'INVALID_ADJUST_MODE');
    }
    const [[goal]] = await db.execute(
        `SELECT id, source_plan_id FROM fitness_goals
          WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [userId]
    );
    if (!goal) throw new AppError('No active goal — complete onboarding first', 404, 'NO_ACTIVE_GOAL');
    if (!goal.source_plan_id) {
        throw new AppError('No linked training plan — generate one from your goal first', 404, 'PLAN_NOT_LINKED');
    }
    const [[plan]] = await db.execute(
        `SELECT id, description, owner_user_id FROM plans WHERE id = ? LIMIT 1`,
        [goal.source_plan_id]
    );
    if (!plan) throw new AppError('Linked plan not found', 404, 'PLAN_NOT_FOUND');
    if (plan.owner_user_id == null || String(plan.owner_user_id) !== String(userId)) {
        throw new AppError('Only the plan owner can adjust it', 403, 'FORBIDDEN');
    }

    const note = ADJUST_NOTES[mode];
    // Idempotent guard: each mode may be applied once per plan. Previously
    // this check only skipped the description update while the +1 set / +10s
    // hold SQL still executed on every click — silently stacking load while
    // the API claimed "Already adjusted".
    if (String(plan.description || '').includes(note)) {
        return {
            planId: plan.id,
            mode,
            alreadyApplied: true,
            message: `Already adjusted (${note}) — apply was skipped. Edit the plan manually for further changes.`,
        };
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        if (mode === 'shorter') {
            await conn.execute(
                `UPDATE plan_contents SET duration_mins = LEAST(duration_mins, 30) WHERE plan_id = ?`,
                [plan.id]
            );
        } else {
            // Rep-based exercises: one more set (cap 5), rest bumped for safety.
            await conn.execute(
                `UPDATE plan_exercises pe
                   JOIN plan_contents pc ON pc.id = pe.plan_content_id
                    SET pe.sets = LEAST(pe.sets + 1, 5)
                  WHERE pc.plan_id = ? AND pe.reps IS NOT NULL`,
                [plan.id]
            );
            // Hold-based exercises: longer holds (cap 120s) + extra rest.
            await conn.execute(
                `UPDATE plan_exercises pe
                   JOIN plan_contents pc ON pc.id = pe.plan_content_id
                    SET pe.duration_seconds = LEAST(pe.duration_seconds + 10, 120),
                        pe.rest_seconds = LEAST(COALESCE(pe.rest_seconds, 45) + 10, 120)
                  WHERE pc.plan_id = ? AND pe.duration_seconds IS NOT NULL`,
                [plan.id]
            );
        }
        // Always note — the guard above guarantees this path runs once.
        const desc = `${plan.description || ''} ${note}`.trim().slice(0, 2000);
        await conn.execute('UPDATE plans SET description = ? WHERE id = ?', [desc, plan.id]);
        await conn.query('COMMIT');
        return { planId: plan.id, mode, message: `Plan adjusted — ${note}` };
    } catch (err) {
        try { await conn.query('ROLLBACK'); } catch { /* noop */ }
        throw err;
    } finally {
        try { conn.release(); } catch { /* noop */ }
    }
}

// GET /api/plans/goal-status/:userId — active goal + its linked training plan.
// Connects My Plans to user goals without changing the plans list shape.
// Pre-032 databases (no source_plan_id) still return the goal with linkedPlan null.
async function getGoalStatus(userId) {
    let rows;
    try {
        [rows] = await db.execute(
            `SELECT id, goal_type, daily_kcal, protein_g, carbs_g, fat_g, target_weight_kg, source_plan_id
             FROM fitness_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
            [userId]
        );
    } catch (e) {
        if (e && (e.errno === 1054 || /Unknown column 'source_plan_id'/.test(e.message || ''))) {
            [rows] = await db.execute(
                `SELECT id, goal_type, daily_kcal, protein_g, carbs_g, fat_g, target_weight_kg
                 FROM fitness_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
                [userId]
            );
        } else {
            throw e;
        }
    }
    if (!rows || rows.length === 0) return { goal: null, linkedPlan: null };
    const g = rows[0];
    const goal = {
        id: g.id,
        goalType: g.goal_type,
        dailyKcal: g.daily_kcal != null ? Number(g.daily_kcal) : null,
        proteinG: g.protein_g != null ? Number(g.protein_g) : null,
        carbsG: g.carbs_g != null ? Number(g.carbs_g) : null,
        fatG: g.fat_g != null ? Number(g.fat_g) : null,
        targetWeightKg: g.target_weight_kg != null ? Number(g.target_weight_kg) : null,
        sourcePlanId: g.source_plan_id != null ? Number(g.source_plan_id) : null,
    };
    let linkedPlan = null;
    if (goal.sourcePlanId) {
        try {
            const [[plan]] = await db.execute('SELECT id, title FROM plans WHERE id = ? LIMIT 1', [goal.sourcePlanId]);
            if (plan) linkedPlan = { id: plan.id, title: plan.title };
        } catch { linkedPlan = null; }
    }
    return { goal, linkedPlan };
}

module.exports = {
    STARTER_BY_TAG,
    starterForTag,
    humanizeGoal,
    tagForGoal,
    enroll,
    completeProgress,
    getProgress,
    getPlanContent,
    getPlansForUser,
    createPersonalPlan,
    updatePersonalPlan,
    deletePersonalPlan,
    autoCreateFromGoal,
    getGoalStatus,
    adjustLinkedPlan,
};
