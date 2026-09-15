import "server-only";
import { cache } from "react";
import { initTRPC } from "@trpc/server";


export const createTRPCContext = cache(async () => {
  return {};
});

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
