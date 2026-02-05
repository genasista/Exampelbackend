import { Router } from "express";

const router = Router();

// POST /__sandbox/prove-egress-block
router.post("/prove-egress-block", async (_req, res) => {
  try {
    // Detta anrop ska blockeras av vår fetch-guard i sandbox-läge
    const r = await fetch("https://example.com/ping");
    // Om vi kommer hit så blockerades inte egress (fel i sandbox-guard)
    return res.status(500).json({
      ok: false,
      blocked: false,
      message: `Egress borde ha blockats (fick status ${r.status})`,
    });
  } catch (err: any) {
    // Förväntad väg i sandbox: guard kastar fel
    return res.json({
      ok: true,
      blocked: true,
      code: err?.code ?? "EGRESS_BLOCKED",
      message: String(err?.message ?? err),
    });
  }
});

export default router;