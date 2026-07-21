// CSV export parity tests for GET /api/admin/ai-usage/log.csv — the exported
// file must contain EXACTLY the same rows the admin sees on /admin/ai-logs
// (same shared filter builder), plus the 50 000-row cap and the admin guard.
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { db, aiUsageLog } from "@workspace/db";
import app from "../src/app";
import { createUser, createAdmin } from "./helpers/factories";
import { aiLogExportLimits } from "../src/routes/admin";

const ORIGINAL_LIMITS = { ...aiLogExportLimits };
afterEach(() => {
  Object.assign(aiLogExportLimits, ORIGINAL_LIMITS);
});

// Reverse maps for the Polish CSV labels back to raw values.
const OPERATION_FROM_PL: Record<string, string> = {
  Sprawdzenie: "check",
  Czat: "chat",
  "Test admina": "admin-test",
};
const STATUS_FROM_PL: Record<string, string> = { Udane: "completed", Błąd: "failed" };

// Minimal RFC-ish CSV parser for ';'-separated lines with '"' quoting.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore, handled at \n
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchCsv(token: string, query = "") {
  const res = await request(app)
    .get(`/api/admin/ai-usage/log.csv${query}`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toContain("text/csv");
  const text = res.text;
  // UTF-8 BOM so Polish Excel detects the encoding.
  expect(text.startsWith("\uFEFF")).toBe(true);
  const rows = parseCsv(text.slice(1));
  const header = rows[0];
  expect(header[0]).toBe("Data");
  return { header, dataRows: rows.slice(1) };
}

// Key both sources by the fields present in both: ISO date, e-mail,
// operation, status.
function csvRowKey(header: string[], row: string[]): string {
  const col = (name: string) => row[header.indexOf(name)];
  return [
    col("Data"),
    col("E-mail"),
    OPERATION_FROM_PL[col("Operacja")] ?? col("Operacja"),
    STATUS_FROM_PL[col("Status")] ?? col("Status"),
  ].join("|");
}

function jsonEntryKey(e: any): string {
  return [e.createdAt, e.userEmail ?? "", e.operation, e.status].join("|");
}

async function fetchJsonKeys(token: string, query: string): Promise<string[]> {
  const sep = query ? "&" : "?";
  const res = await request(app)
    .get(`/api/admin/ai-usage/log${query}${sep}limit=100&page=1`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.entries.map(jsonEntryKey).sort();
}

// Seed rows spanning statuses, operations, models, users and dates.
async function seedRows() {
  const anna = await createUser({
    email: "anna.kowalska@test.pl",
    firstName: "Anna",
    lastName: "Kowalska",
  });
  const jan = await createUser({
    email: "jan.nowak@test.pl",
    firstName: "Jan",
    lastName: "Nowak; \"junior\"", // forces CSV quoting in userName
  });
  await db.insert(aiUsageLog).values([
    {
      userId: anna.user.id,
      operation: "check",
      model: "gemini-flash-latest",
      status: "completed",
      attempts: 1,
      estCostGrosz: "0.250000",
      latencyMs: 1500,
      createdAt: new Date("2026-07-05T10:00:00Z"),
    },
    {
      userId: anna.user.id,
      operation: "chat",
      model: "gemini-flash-lite-latest",
      status: "failed",
      httpStatus: 503,
      attempts: 4,
      errorMessage: 'Model "overloaded"; try later\nagain',
      latencyMs: 8000,
      createdAt: new Date("2026-07-10T10:00:00Z"),
    },
    {
      userId: jan.user.id,
      operation: "check",
      model: "gemini-flash-latest",
      status: "failed",
      httpStatus: 429,
      attempts: 2,
      createdAt: new Date("2026-07-12T10:00:00Z"),
    },
    {
      userId: jan.user.id,
      operation: "chat",
      model: "gemini-flash-latest",
      status: "completed",
      attempts: 1,
      createdAt: new Date("2026-07-15T23:30:00Z"),
    },
    {
      userId: null,
      operation: "admin-test",
      model: "gemini-flash-lite-latest",
      status: "completed",
      attempts: 1,
      createdAt: new Date("2026-07-18T10:00:00Z"),
    },
  ]);
}

describe("GET /api/admin/ai-usage/log.csv", () => {
  it("is admin-only (401 unauthenticated, 403 non-admin)", async () => {
    const noAuth = await request(app).get("/api/admin/ai-usage/log.csv");
    expect(noAuth.status).toBe(401);

    const { token } = await createUser();
    const res = await request(app)
      .get("/api/admin/ai-usage/log.csv")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("exports exactly the rows the JSON endpoint returns, per filter combo", async () => {
    await seedRows();
    const { token } = await createAdmin();

    const filterCombos = [
      "", // no filters — everything
      "?status=failed",
      "?operation=check",
      "?model=gemini-flash-latest",
      "?status=completed&operation=chat",
      "?search=kowal", // name search drops user-less rows
      "?from=2026-07-11", // date range
      "?to=2026-07-15", // date-only 'to' is inclusive through end of day
      "?from=2026-07-06&to=2026-07-12&status=failed",
      "?search=nie-ma-takiego", // matches nothing
    ];

    for (const query of filterCombos) {
      const jsonKeys = await fetchJsonKeys(token, query);
      const { header, dataRows } = await fetchCsv(token, query);
      const csvKeys = dataRows.map((row) => csvRowKey(header, row)).sort();
      expect(csvKeys, `filter combo "${query}"`).toEqual(jsonKeys);
    }

    // Sanity: the unfiltered export really contains all 5 seeded rows.
    const { dataRows } = await fetchCsv(token);
    expect(dataRows).toHaveLength(5);
  });

  it("quotes fields containing the separator, quotes and newlines", async () => {
    await seedRows();
    const { token } = await createAdmin();
    const { header, dataRows } = await fetchCsv(token, "?status=failed");

    const nameIdx = header.indexOf("Uczeń");
    const errIdx = header.indexOf("Komunikat błędu");
    const names = dataRows.map((r) => r[nameIdx]);
    expect(names).toContain('Jan Nowak; "junior"');
    const errors = dataRows.map((r) => r[errIdx]);
    expect(errors).toContain('Model "overloaded"; try later\nagain');
  });

  it("caps the export at the configured row limit, newest-first", async () => {
    await seedRows();
    const { token } = await createAdmin();

    // Shrink the cap (and batch size, to exercise the batching loop).
    aiLogExportLimits.maxRows = 3;
    aiLogExportLimits.batch = 2;

    const { header, dataRows } = await fetchCsv(token);
    expect(dataRows).toHaveLength(3);
    // The cap keeps the NEWEST rows — same order the admin sees on screen.
    const dateIdx = header.indexOf("Data");
    expect(dataRows.map((r) => r[dateIdx])).toEqual([
      "2026-07-18T10:00:00.000Z",
      "2026-07-15T23:30:00.000Z",
      "2026-07-12T10:00:00.000Z",
    ]);
  });
});
