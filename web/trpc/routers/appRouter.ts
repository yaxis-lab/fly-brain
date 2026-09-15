import { router } from "../init";
import { neuronRouter } from "./neuronRouter";

export const appRouter = router({
  neuron: neuronRouter,
});

export type AppRouter = typeof appRouter;
