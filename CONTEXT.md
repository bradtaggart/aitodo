# AI Todo

A self-hosted, multi-user task management app. Each user owns their own isolated set of tasks, categories, and templates.

## Language

**Account**:
A registered identity with an email address, display name, and hashed password.
_Avoid_: User (overloaded — use Account when referring to identity/auth, User only in the DB layer)

**Task**:
A single unit of work owned by an Account, optionally nested under a parent Task.
_Avoid_: Todo, item

**Category**:
A label with a name and color, owned by an Account, used to group Tasks.

**Template**:
A recurring task pattern owned by an Account that spawns new Tasks on a schedule.

**Session**:
A JWT stored in an httpOnly cookie, valid for 30 days, that proves an Account's identity on each request.
_Avoid_: Token (use Session when referring to the auth state, Token only when discussing the JWT implementation detail)

## Relationships

- An **Account** owns zero or more **Tasks**
- An **Account** owns zero or more **Categories**
- An **Account** owns zero or more **Templates**
- A **Task** may have a parent **Task** (nesting), but both must belong to the same **Account**
- A **Task** may reference one **Category** owned by the same **Account**
- A **Template** spawns **Tasks** for the same **Account**

## Example dialogue

> **Dev:** "When a new **Account** is created, do they inherit any default **Categories**?"
> **Domain expert:** "No — each **Account** starts empty. Existing data was seeded to the admin **Account** during migration."

> **Dev:** "Can a **Task** reference a **Category** from a different **Account**?"
> **Domain expert:** "Never — all data is strictly isolated per **Account**."

## Flagged ambiguities

- "User" was used in both the DB schema and product language — resolved: **Account** is the product-level term; "user" is kept only in the DB table name and persistence layer for backward compatibility.
