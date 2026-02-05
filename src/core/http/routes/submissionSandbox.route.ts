// src/core/http/routes/submissionSandbox.route.ts
import { Router } from "express";
import crypto from "crypto";
import rabbit, { RK_SUBMISSION_CREATED } from "@core/messaging/rabbit.runtime";

const router = Router();

/**
 * POST /__sandbox/emit-submission
 * Body: { submissionId: string }
 * Publishes a submission.created event for demo/testing.
 */
router.post("/emit-submission", async (req, res, next) => {
  try {
    const { submissionId } = req.body ?? {};
    if (!submissionId || typeof submissionId !== "string") {
      return res
        .status(400)
        .json({ code: "bad_request", message: "submissionId (string) krävs" });
    }

    const correlationId =
      (req as any).correlationId ??
      req.header("x-correlation-id") ??
      crypto.randomUUID();

    const event = {
      id: crypto.randomUUID(),
      type: RK_SUBMISSION_CREATED,
      time: new Date().toISOString(),
      correlationId,
      idempotencyKey: submissionId,
      specVersion: "1.0",
      eventVersion: "1",
      payload: { submissionId },
    };

    await rabbit.publishEvent(RK_SUBMISSION_CREATED, event);
    return res.json({ ok: true, published: event });
  } catch (err) {
    return next(err);
  }
});

export default router;
