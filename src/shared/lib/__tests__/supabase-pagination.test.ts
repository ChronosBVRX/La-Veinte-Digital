import { describe, it, expect } from "vitest";
import { fetchAllSupabaseRows, chunkArray, toSupabaseError } from "../supabase-pagination";

describe("fetchAllSupabaseRows", () => {
  it("retrieves all rows across multiple pages when total > pageSize", async () => {
    const totalRecords = 1201;
    const pageSize = 500;
    const mockData = Array.from({ length: totalRecords }, (_, i) => ({ id: `id-${i}`, num: i }));

    const requestedRanges: Array<{ from: number; to: number }> = [];

    const result = await fetchAllSupabaseRows(
      async ({ from, to }) => {
        requestedRanges.push({ from, to });
        const slice = mockData.slice(from, to + 1);
        return { data: slice, error: null };
      },
      { pageSize },
    );

    expect(result).toHaveLength(1201);
    expect(result[0].num).toBe(0);
    expect(result[1200].num).toBe(1200);

    // Should have requested 3 pages: 0-499 (500), 500-999 (500), 1000-1499 (201)
    expect(requestedRanges).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
      { from: 1000, to: 1499 },
    ]);
  });

  it("handles exactly pageSize rows by requesting the next empty page and stopping", async () => {
    const pageSize = 500;
    const mockData = Array.from({ length: 500 }, (_, i) => ({ id: `id-${i}` }));
    const requestedRanges: Array<{ from: number; to: number }> = [];

    const result = await fetchAllSupabaseRows(
      async ({ from, to }) => {
        requestedRanges.push({ from, to });
        const slice = mockData.slice(from, to + 1);
        return { data: slice, error: null };
      },
      { pageSize },
    );

    expect(result).toHaveLength(500);
    expect(requestedRanges).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
    ]);
  });

  it("handles empty results gracefully", async () => {
    const result = await fetchAllSupabaseRows(
      async () => ({ data: [], error: null }),
      { pageSize: 500 },
    );

    expect(result).toEqual([]);
  });

  it("handles null data gracefully", async () => {
    const result = await fetchAllSupabaseRows(
      async () => ({ data: null, error: null }),
      { pageSize: 500 },
    );

    expect(result).toEqual([]);
  });

  it("propagates database errors immediately as serialized Error", async () => {
    await expect(
      fetchAllSupabaseRows(
        async () => ({
          data: null,
          error: {
            code: "42703",
            message: "column union_workers.adscripcion does not exist",
            details: "No such column in relation",
            hint: "Check column name",
          },
        }),
      ),
    ).rejects.toThrow("[42703] column union_workers.adscripcion does not exist · No such column in relation · Check column name");
  });
});

describe("toSupabaseError", () => {
  it("returns the exact Error if already an Error instance", () => {
    const err = new Error("Generic failure");
    expect(toSupabaseError(err)).toBe(err);
  });

  it("serializes PostgREST error object into readable string without [object Object]", () => {
    const postgrestErr = {
      code: "42703",
      message: "column union_workers.adscripcion does not exist",
      details: "Detail message",
      hint: "Hint message",
    };

    const err = toSupabaseError(postgrestErr);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(
      "[42703] column union_workers.adscripcion does not exist · Detail message · Hint message",
    );
    expect(err.message).not.toContain("[object Object]");
  });

  it("handles PostgREST error with only message and code", () => {
    const postgrestErr = {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    };

    const err = toSupabaseError(postgrestErr);
    expect(err.message).toBe("[PGRST116] JSON object requested, multiple (or no) rows returned");
  });

  it("handles unknown string or primitive input gracefully", () => {
    const err = toSupabaseError("Network disconnected");
    expect(err.message).toBe("Network disconnected");
  });

  it("handles empty object without crashing or outputting [object Object]", () => {
    const err = toSupabaseError({});
    expect(err.message).toBe("Error desconocido de Supabase/PostgREST");
  });
});

describe("chunkArray", () => {
  it("chunks an array into correct chunk sizes", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const chunks = chunkArray(items, 3);
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("handles empty arrays", () => {
    expect(chunkArray([], 10)).toEqual([]);
  });

  it("handles invalid or zero chunk sizes by returning the array wrapped", () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});
