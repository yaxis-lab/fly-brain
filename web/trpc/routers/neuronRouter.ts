import { z } from "zod";
import { queryDb } from "@/app/db";
import { router, publicProcedure } from "../init";

export const NeuronSearchSchema = z.object({
  bodyId: z.string(),
  type: z.string().nullable(),
  instance: z.string().nullable(),
  superclass: z.string().nullable(),
  status: z.string().nullable(),
});

export type NeuronSearchResult = z.infer<typeof NeuronSearchSchema>;

export const neuronRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(50),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      const safeTerm = input.query.trim();

      try {
        const sql = `
          SELECT 
              CAST(bodyId AS VARCHAR) as bodyId,
              "type",
              instance,
              superclass,
              status
          FROM neurons
          WHERE 
              CAST(bodyId AS VARCHAR) LIKE $search ESCAPE '\\'
              OR "type" ILIKE $search ESCAPE '\\'
              OR instance ILIKE $search ESCAPE '\\'
              OR synonyms ILIKE $search ESCAPE '\\'
          ORDER BY 
              CASE 
                  WHEN CAST(bodyId AS VARCHAR) = $exact THEN 1
                  WHEN LOWER("type") = LOWER($exact) THEN 2
                  ELSE 3
              END,
              "type" ASC
          LIMIT $limit
        `;

        const params = {
          search: `%${safeTerm}%`,
          exact: input.query,
          limit: input.limit,
        };

        const results = await queryDb<NeuronSearchResult>(sql, params);
        return results;
      } catch (error) {
        throw error;
      }
    }),
});
