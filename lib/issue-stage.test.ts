import { describe, expect, it, vi } from "vitest";
import {
  confirmationCount,
  intakeKind,
  isConfirmedCount,
  isIssueConfirmed,
  isTriageClearedBug,
  issueStage,
  openIssueStages,
  parseIssueStageView,
  type TriageClearance,
} from "./issue-stage";

const bug = { beneficiaryUserId: "beneficiary", reporterId: "reporter", createdByAgent: null, claims: [] };

describe("issueStage", () => {
  it("calls every unconfirmed open issue reported, whoever filed it", () => {
    expect(issueStage({ status: "open", voteCount: 0, confirmed: false })).toBe("reported");
    expect(issueStage({ status: "open", voteCount: 5, confirmed: false })).toBe("reported");
  });

  it("calls a confirmed issue with fewer than three upvotes confirmed", () => {
    expect(issueStage({ status: "open", voteCount: 2, confirmed: true })).toBe("confirmed");
  });

  it("calls a confirmed issue with three upvotes ready", () => {
    expect(issueStage({ status: "open", voteCount: 3, confirmed: true })).toBe("ready");
    expect(issueStage({ status: "open", voteCount: 8, confirmed: true })).toBe("ready");
  });

  it("leaves the work status alone once someone starts it", () => {
    expect(issueStage({ status: "in_progress", voteCount: 4, confirmed: true })).toBeNull();
    expect(issueStage({ status: "resolved", voteCount: 0, confirmed: false })).toBeNull();
  });
});

describe("confirmationCount", () => {
  it("excludes legacy reviews credited to the reporter from displayed confirmation counts", () => {
    expect(confirmationCount({
      createdByAgentId: "filer", undoneIds: new Set(), bug,
      accepts: [
        { id: "v1", agentId: "a", ownerUserId: "one", onBehalfOfUserId: "reporter" },
        { id: "v2", agentId: "b", ownerUserId: "two", onBehalfOfUserId: "two" },
      ],
    })).toBe(1);
  });
  it("confirms on two independent owners", () => {
    const count = confirmationCount({
      createdByAgentId: "filer",
      undoneIds: new Set(),
      bug,
      accepts: [
        { id: "v1", agentId: "a", ownerUserId: "one" },
        { id: "v2", agentId: "b", ownerUserId: "two" },
      ],
    });
    expect(count).toBe(2);
    expect(isConfirmedCount(count)).toBe(true);
  });

  it("does not confirm two accepts from the same owner, the filer, or an undone review", () => {
    const count = confirmationCount({
      createdByAgentId: "filer",
      undoneIds: new Set(["gone"]),
      bug,
      accepts: [
        { id: "v1", agentId: "a", ownerUserId: "one" },
        { id: "v2", agentId: "b", ownerUserId: "one" },
        { id: "own", agentId: "filer", ownerUserId: "three" },
        { id: "gone", agentId: "c", ownerUserId: "four" },
        { id: "self", agentId: "d", ownerUserId: "reporter" },
      ],
    });
    expect(isConfirmedCount(count)).toBe(false);
  });
});

describe("intake", () => {
  it("keeps an open report an idea until it is confirmed and upvoted", () => {
    expect(intakeKind({ status: "open", voteCount: 5, confirmed: false })).toBe("idea");
    expect(intakeKind({ status: "open", voteCount: 2, confirmed: true })).toBe("idea");
    expect(intakeKind({ status: "open", voteCount: 3, confirmed: true })).toBe("issue");
  });

  it("keeps a started or finished report an issue", () => {
    expect(intakeKind({ status: "in_progress", voteCount: 4, confirmed: true })).toBe("issue");
    expect(intakeKind({ status: "closed", voteCount: 0, confirmed: false })).toBe("idea");
  });
});

describe("parseIssueStageView", () => {
  it("keeps the idea filters and the issue filter", () => {
    expect(parseIssueStageView("reported")).toBe("reported");
    expect(parseIssueStageView("confirmed")).toBe("confirmed");
    expect(parseIssueStageView("ready")).toBe("ready");
    expect(parseIssueStageView(undefined)).toBeNull();
  });
});

describe("isTriageClearedBug and isIssueConfirmed", () => {
  const triagerClear: TriageClearance = {
    id: "clear-1",
    agentId: "triager-agent",
    createdAt: new Date("2026-10-22T10:00:00Z"),
    agent: { id: "triager-agent", ownerUserId: "triager-owner", level: "triager" },
  };

  it("clears triage with an independent triager-level agent", () => {
    const cleared = isTriageClearedBug({
      createdByAgentId: "filer-agent",
      clears: [triagerClear],
      undoneIds: new Set(),
      bug,
    });
    expect(cleared).toBe(true);
  });

  it("does not clear triage when agent lacks triager level", () => {
    const cleared = isTriageClearedBug({
      createdByAgentId: "filer-agent",
      clears: [{
        ...triagerClear,
        agent: { ...triagerClear.agent, level: "reviewer" },
      }],
      undoneIds: new Set(),
      bug,
    });
    expect(cleared).toBe(false);
  });

  it("does not clear triage when the clear was marked undone", () => {
    const cleared = isTriageClearedBug({
      createdByAgentId: "filer-agent",
      clears: [triagerClear],
      undoneIds: new Set(["clear-1"]),
      bug,
    });
    expect(cleared).toBe(false);
  });

  it("does not clear triage when the clear is older than the latest revision", () => {
    const cleared = isTriageClearedBug({
      createdByAgentId: "filer-agent",
      clears: [triagerClear],
      undoneIds: new Set(),
      bug,
      revisedAt: new Date("2026-10-22T11:00:00Z"),
    });
    expect(cleared).toBe(false);
  });

  it("requires both confirmation count AND triage clearance to confirm", () => {
    // 2 reviewer accepts but NO triage clearance -> false
    expect(isIssueConfirmed({
      confirmationCount: 2,
      confirmationsNeeded: 2,
      triageCleared: false,
    })).toBe(false);

    // Triage clearance but only 1 reviewer accept -> false
    expect(isIssueConfirmed({
      confirmationCount: 1,
      confirmationsNeeded: 2,
      triageCleared: true,
    })).toBe(false);

    // Both reviewer accepts and triage clearance -> true
    expect(isIssueConfirmed({
      confirmationCount: 2,
      confirmationsNeeded: 2,
      triageCleared: true,
    })).toBe(true);
  });
});

describe("openIssueStages with triage clearance", () => {
  it("keeps an issue reported if it lacks triage clearance even with 3 upvotes", async () => {
    const mockDb = {
      bug: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "bug-1",
            projectId: "proj-1",
            status: "open",
            voteCount: 3,
            beneficiaryUserId: "user-1",
            assigneeId: null,
            reporterId: "reporter-user",
            createdByAgentId: "agent-filer",
            createdByAgent: { ownerUserId: "reporter-user" },
            claims: [],
          },
        ]),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "proj-1", workflowConfig: null }),
      },
      bugRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      issueValidation: {
        findMany: vi.fn().mockResolvedValue([
          // Two reviewer accepts, but NO duplicate/reject clearance
          {
            id: "val-1",
            bugId: "bug-1",
            kind: "real",
            verdict: "accept",
            createdAt: new Date(),
            agentId: "agent-1",
            onBehalfOfUserId: "owner-1",
            agent: { id: "agent-1", ownerUserId: "owner-1", level: "reviewer" },
          },
          {
            id: "val-2",
            bugId: "bug-1",
            kind: "real",
            verdict: "accept",
            createdAt: new Date(),
            agentId: "agent-2",
            onBehalfOfUserId: "owner-2",
            agent: { id: "agent-2", ownerUserId: "owner-2", level: "reviewer" },
          },
        ]),
      },
      agentAuditEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const stages = await openIssueStages(mockDb, {});
    // Must be "reported", NOT "ready"!
    expect(stages.get("bug-1")).toBe("reported");
  });

  it("promotes issue to ready when both reviewer accepts and triage clearance exist", async () => {
    const mockDb = {
      bug: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "bug-1",
            projectId: "proj-1",
            status: "open",
            voteCount: 3,
            beneficiaryUserId: "user-1",
            assigneeId: null,
            reporterId: "reporter-user",
            createdByAgentId: "agent-filer",
            createdByAgent: { ownerUserId: "reporter-user" },
            claims: [],
          },
        ]),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "proj-1", workflowConfig: null }),
      },
      bugRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      issueValidation: {
        findMany: vi.fn().mockResolvedValue([
          // Two reviewer accepts
          {
            id: "val-1",
            bugId: "bug-1",
            kind: "real",
            verdict: "accept",
            createdAt: new Date(),
            agentId: "agent-1",
            onBehalfOfUserId: "owner-1",
            agent: { id: "agent-1", ownerUserId: "owner-1", level: "reviewer" },
          },
          {
            id: "val-2",
            bugId: "bug-1",
            kind: "real",
            verdict: "accept",
            createdAt: new Date(),
            agentId: "agent-2",
            onBehalfOfUserId: "owner-2",
            agent: { id: "agent-2", ownerUserId: "owner-2", level: "reviewer" },
          },
          // Triager clearance
          {
            id: "val-3",
            bugId: "bug-1",
            kind: "duplicate",
            verdict: "reject",
            createdAt: new Date(),
            agentId: "agent-triager",
            onBehalfOfUserId: "owner-triager",
            agent: { id: "agent-triager", ownerUserId: "owner-triager", level: "triager" },
          },
        ]),
      },
      agentAuditEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const stages = await openIssueStages(mockDb, {});
    expect(stages.get("bug-1")).toBe("ready");
  });
});
