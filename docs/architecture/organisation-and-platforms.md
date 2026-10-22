# Architecture Decision: Standardize Hierarchy on Organisation and Platforms (ENDOR-441)

## Status
Accepted & In Implementation

## Context & Motivation
Previously, the system maintained multiple overlapping conceptual layers:
- **Workspaces / Tenants**: Top-level tenant boundaries in database and routing.
- **Organisations**: User-facing organizational identity.
- **Projects**: Sub-tenant groupings that created redundant nested silos for tasks and keys.
- **Categories / Platforms**: Tags representing runtime environments (Desktop, Web, Mobile).

This multi-layer structure caused user confusion, fragmented issue backlogs across projects within the same team, and added unnecessary operational overhead. In practice, modern development teams operate as an unified **Organisation** working across **Platforms** (e.g., Desktop, Mobile, Web, Backend).

## 2-Tier Architectural Hierarchy
We standardize the domain model into a clean 2-tier hierarchy:

```
+--------------------------------------------------------------+
|                     ORGANISATION (Tenant)                   |
|  - Membership & Roles (Owner, Admin, Member, Observer)       |
|  - Agent Keys & Quotas                                       |
|  - Repositories & Webhooks                                   |
|  - Unified Issue Backlog                                     |
+--------------------------------------------------------------+
                               |
                               | Categorized by
                               v
+--------------------------------------------------------------+
|                          PLATFORMS                           |
|  - Desktop                                                   |
|  - Mobile (iOS, Android)                                     |
|  - Web                                                       |
|  - Backend / API                                             |
+--------------------------------------------------------------+
```

### 1. Organisation (Top-Level Entity)
- Standardized term across documentation, UI, and navigation representing the team/tenant boundary.
- Holds all members, agents, settings, and shared issue backlog.
- Serves as the sole administrative boundary for access control and billing.

### 2. Platforms (Work Categorization)
- Replaces nested Project silos with lightweight, flexible Platform scopes.
- Every issue can specify a platform (e.g., Desktop, Mobile, Web).
- Filters and views group issues by Platform via tabs without isolating them into walled gardens.

## Project Deprecation & Migration Strategy
To ensure zero downtime and 100% backwards compatibility for existing agents and API integrations:

1. **Inventory of Project Responsibilities**:
   - *Key Scoping*: Agent keys currently reference a `projectId`. These map directly to the organisation's primary project context during the transition.
   - *Workflow Configurations*: Max active claims, silence windows, and reward rules consolidate at the Organisation level.
   - *Repository Links*: Repositories attach directly to the Organisation.

2. **Backwards-Compatible API Invariants**:
   - `projectId` remains accepted on all `/api/v1/*` routes as an optional parameter or transparent alias to the Organisation's active project context.
   - Existing agent pairings and keys continue operating without modification.

3. **UI & Navigation Simplification**:
   - Navigation and settings reflect the unified hierarchy.
   - "Switch workspace" is standardized to "Switch organisation".
   - Platforms management is surfaced directly under Organisation Settings.
