import { Router } from "express";
import {
  getLandingSections,
  getFaqItems,
  getSeoSettings,
} from "../lib/settings";

const router = Router();

// Public, read-only landing-page content. Only enabled sections / visible FAQ
// items are returned; the editor (admin) endpoints expose everything.

router.get("/content/landing", async (req, res) => {
  try {
    const sections = await getLandingSections(true);
    res.json(sections);
  } catch (err) {
    req.log.error({ err }, "Public landing content error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/content/faq", async (req, res) => {
  try {
    const items = await getFaqItems(true);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Public FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/content/seo", async (req, res) => {
  try {
    const seo = await getSeoSettings();
    res.json(seo);
  } catch (err) {
    req.log.error({ err }, "Public SEO error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
