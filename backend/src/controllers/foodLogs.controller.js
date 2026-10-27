// Food logs — thin controller. Logic + DB live in services/foodLogs.service.js.
const notificationController = require("./notification.controller");
const service = require("../services/foodLogs.service");
const allergiesService = require("../services/allergies.service");
const { sendMealSummaryEmail } = require("../services/email.service");
const { AppError } = require("../utils/errors");

const { imageHash } = service;

// POST /api/food-logs/analyze-pic
async function postanalyzePic(req, res, next) {
  try {
    const { base64Image } = req.body;
    if (!base64Image) return res.status(400).json({ error: "No image provided" });
    if (String(base64Image).length > 7_000_000)
      return res.status(413).json({ error: "Image too large (max ~5MB)" });

    try {
      const { result, cached, joined } = await service.analyzeImage(base64Image);

      if (cached) {
        if (process.env.NODE_ENV !== "production")
          console.log("[analyze-pic] ✅ Cache hit — returning stored result");
      } else if (joined && process.env.NODE_ENV !== "production") {
        console.log("[analyze-pic] ↻ Joining in-flight analysis for same image");
      }

      // Allergy flagging is per-user, so it runs AFTER the shared, image-keyed
      // analysis. attachMatches never mutates the cached object.
      res.json(await allergiesService.attachMatches(req.user.id, result));
    } catch (err) {
      console.error("[analyze-pic] ERROR:", err.message);
      next(
        new AppError(
          "AI failed to analyze the image. Please try again.",
          500,
          "AI_ANALYZE_FAILED",
        ),
      );
    }
  } catch (e) {
    next(e);
  }
}

async function postUserIdSuggestPlan(req, res, next) {
  try {
    const { userId } = req.params;
    const { food_name } = req.body || {};
    if (!food_name) return res.status(400).json({ error: "food_name is required" });

    try {
      const payload = await service.suggestPlan(userId, req.body || {});
      res.status(200).json(payload);
    } catch (err) {
      console.error("[suggest-plan] ERROR:", err.message);
      next(new AppError("AI coach could not generate a suggestion", 500, "AI_SUGGEST_FAILED"));
    }
  } catch (e) {
    next(e);
  }
}

async function postUserId(req, res, next) {
  try {
    const { userId } = req.params;
    const {
      food_name,
      grams,
      calories,
      protein,
      carbs,
      fat,
      saturated_fat,
      trans_fat,
      polyunsaturated_fat,
      monounsaturated_fat,
      image_url,
    } = req.body || {};

    if (!food_name || (typeof food_name === "string" && !food_name.trim())) {
      return res.status(400).json({ error: "food_name is required" });
    }
    // Module 4 — meal slot must be a whitelisted value (or absent); the
    // service normalizes anything else to NULL.
    if (req.body?.meal_type && !service.MEAL_TYPES.includes(req.body.meal_type)) {
      return res.status(400).json({ error: "meal_type must be one of: " + service.MEAL_TYPES.join(", ") });
    }
    if (String(food_name).trim().length < 1) {
      return res.status(400).json({ error: "food_name is required" });
    }
    if (typeof image_url === "string" && image_url.length > 2000) {
      return res.status(400).json({ error: "image_url too long (max 2000 chars)" });
    }
    for (const [k, v] of [
      ["calories", calories],
      ["protein", protein],
      ["carbs", carbs],
      ["fat", fat],
      ["saturated_fat", saturated_fat],
      ["trans_fat", trans_fat],
      ["polyunsaturated_fat", polyunsaturated_fat],
      ["monounsaturated_fat", monounsaturated_fat],
    ]) {
      if (
        v !== undefined &&
        v !== null &&
        v !== "" &&
        (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100000)
      ) {
        return res.status(400).json({ error: `${k} must be a number 0–100000` });
      }
    }
    // Portion weight (grams) — optional; 0/empty means "not weighed".
    if (
      grams !== undefined &&
      grams !== null &&
      grams !== "" &&
      (!Number.isFinite(Number(grams)) || Number(grams) < 0 || Number(grams) > 10000)
    ) {
      return res.status(400).json({ error: "grams must be a number 0–10000" });
    }

    const { insertId } = await service.saveFoodLog(userId, req.body || {});
    const { email, summary } = await service.getMealContext(userId);

    if (email) {
      // Non-blocking: never hold the response for SMTP
      setImmediate(async () => {
        try {
          await sendMealSummaryEmail(email, summary);
        } catch (err) {
          console.error("❌ MAILER FAILED:", err.message);
        }
      });
    }

    try {
      const msg = service.buildMealNotification(summary);
      await service.insertNotification(userId, msg);
      notificationController.broadcast(String(userId), { message: msg, type: "success" });
    } catch (err) {
      console.error("❌ NOTIFICATION FAILED:", err.message);
    }

    res.status(200).json({ message: "Food log saved", id: insertId });
  } catch (e) {
    next(e);
  }
}

async function getUserId(req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    try {
      const data = await service.listFoodLogs(userId, limit, offset);
      res.json(data);
    } catch (err) {
      console.error("[food-log GET] ERROR:", err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function deleteUserIdMealId(req, res, next) {
  try {
    const { userId, mealId } = req.params;

    try {
      const deleted = await service.deleteFoodLog(userId, mealId);
      if (!deleted) {
        return res.status(404).json({ error: "Meal not found or already deleted" });
      }
      res.json({ success: true, message: "Meal deleted" });
    } catch (err) {
      console.error("[food-log DELETE] ERROR:", err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// POST /api/food-logs/estimate-density — per-100 g nutrition for a typed dish
// name (manual form's weight-based entry when the dish is not in the catalog).
// AI quota + cache live in the service/middleware, not here.
async function postEstimateDensity(req, res, next) {
  try {
    const foodName = req.body?.food_name ?? req.body?.name;
    if (!foodName || String(foodName).trim().length < 2) {
      return res.status(400).json({ error: "food_name must be at least 2 characters" });
    }
    const payload = await service.estimateFoodDensity(foodName);
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

// GET /api/food-catalog?q= — Module 4 catalog autocomplete for the manual
// meal form. Thin: q + limit straight to the service.
async function getFoodCatalog(req, res, next) {
  try {
    const rows = await service.searchFoodCatalog(req.query?.q, req.query?.limit);
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  postanalyzePic,
  postUserIdSuggestPlan,
  postUserId,
  postEstimateDensity,
  getFoodCatalog,
  getUserId,
  deleteUserIdMealId,
  imageHash,
};
