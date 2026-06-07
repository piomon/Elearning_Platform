import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import coursesRouter from "./courses";
import progressRouter from "./progress";
import quizzesRouter from "./quizzes";
import aiRouter from "./ai";
import paymentsRouter from "./payments";
import contactRouter from "./contact";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(coursesRouter);
router.use(progressRouter);
router.use(quizzesRouter);
router.use(aiRouter);
router.use(paymentsRouter);
router.use(contactRouter);
router.use(adminRouter);

export default router;
