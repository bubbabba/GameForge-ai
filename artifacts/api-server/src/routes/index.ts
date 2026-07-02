import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gamesRouter from "./games";
import reviewsRouter from "./reviews";
import usersRouter from "./users";
import storageRouter from "./storage";
import imagesRouter from "./images";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(imagesRouter);
router.use(gamesRouter);
router.use(reviewsRouter);
router.use(usersRouter);

export default router;
