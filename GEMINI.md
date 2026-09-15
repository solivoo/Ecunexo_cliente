# EcuNexo Frontend Guidelines & UI/UX Standards

When creating or modifying UI components, views, layouts, or styles in this repository:

1. **Leverage glubox for atomic components**:
   - Use `glubox` for `Button`, `TextBox`, `Select`, `Popup`, `Toast`, `DataGrid`, `RangeDateBox`, `ColorPicker`, `FileBox`, and `Sidebar`.
2. **Apply Google Material Design 3 (M3) + Modern Enterprise SaaS patterns**:
   - Organize pages using standard layouts: `PageHeader` (title, badge, lead, action buttons) -> KPI / `StatCard` strip -> `SectionCard` containers -> `DataGrid` with toolbars.
   - ALWAYS wrap `StatCard` items inside `<div className="ecu-stat-grid">`. NEVER render `<StatCard>` inside an unstyled block `div`, which causes cards to take 100% width and stack vertically.
   - Wrap view contents in `.ecu-dashboard-layout` (or `.ecu-dashboard-layout--fluid` for wide views, unified at `--ecu-layout-max-width: 1720px` to optimize 32" monitors and high-resolution grids).
   - Avoid plain or flat screens with isolated tables or links.
   - Use semantic design tokens: `var(--glb-surface)`, `var(--shell-border)`, `var(--shell-primary)`, `var(--glb-text)`, `var(--glb-muted)`.
   - Implement elegant empty states and loading skeletons instead of bare empty tables.
   - Support dark mode (`html.sf-dark-mode`) seamlessly with subtle translucent borders (`rgba(255,255,255,0.08)`) and soft contrast.
3. **Strictly avoid duplicate action buttons in PageHeader & EcuPageActions**:
   - In desktop view, `<EcuPageActions items={actionItems} />` renders its items directly as buttons in the toolbar (`.ecu-page-actions__desktop`).
   - NEVER add an action to `actionItems` if that action is already rendered as a standalone `<Button>` in `PageHeader.actions` (e.g. creating items, canceling batches, downloading reports). This prevents duplicate buttons appearing side by side.
4. **Semantic Versioning on Demand (Explicit Pull/Release Request Only)**:
   - NEVER increment `"version"` in `ecunexo_admin/package.json` or update `AboutAppModal.tsx` during routine tasks, bug fixes, UI refactors, or individual prompt turns.
   - ONLY evaluate and increment the semantic version (`MAJOR.MINOR.PATCH`) when the user explicitly requests to do a pull, push, release, or version bump (e.g. "haz pull", "prepara el release", "incrementa la versión").
   - When explicitly requested:
     - **PATCH**: Bug fixes, styling adjustments, removing duplicate buttons, minor validations on existing views, copy/text tweaks.
     - **MINOR**: New modules, new pages/views (e.g. Directorio de Clientes), new endpoints, new workflows, major validations.
     - **MAJOR**: Breaking API changes, destructive database schema migrations, architectural shifts.
     - Increment `"version"` in `ecunexo_admin/package.json` and sync the `AboutAppModal.tsx` changelog.
     - Reference the new version in the git commit message (e.g. `feat(clientes): ... [v0.8.0]`).
5. **Active Context & Token Optimization**:
   - Maintain `.agents/ACTIVE_CONTEXT.md` updated with the active module, architectural decisions, and current phase.
   - When starting or resuming complex tasks across sessions, consult `.agents/ACTIVE_CONTEXT.md` to avoid re-reading large histories or asking repetitive questions.
6. **Mandatory Testing & Quality Assurance (Backend & Frontend)**:
   - When creating or modifying domain entities, business logic, endpoints, or critical frontend components: ALWAYS write corresponding automated unit/integration tests alongside the code.
   - **Backend:** Create unit tests in `EcuNexo.Core.UnitTests` (domain rules, invariants, validaciones SRI) and `EcuNexo.Business.UnitTests` (handlers, CQRS commands/queries).
   - **Frontend:** Include component/e2e tests in `tests-ui/` or unit helpers whenever new flows or critical forms are introduced.
   - Never consider a feature "complete" without its accompanying test suite verifying positive, negative, and edge cases.
7. **Mandatory Licensing Prompt on Module Creation**:
   - ALWAYS generate and include a structured prompt at the end of the turn when a new functional module is created or developed (using the skill `licenciamiento-modulo-prompt`).
   - The prompt must be ready to copy and send to the licensing/entitlements team/agent, detailing: `ModuleCode`, `ModuleDependencyGraph` dependencies, `ModuleTierCatalog` limits per tier, RBAC permissions, commercial plans inclusion, and frontend routes.
8. **Strict RBAC Permission Code Format & Seeder Invariants**:
   - Every permission code in EcuNexo MUST strictly adhere to the domain regex enforced in `Permission.cs`: `^[a-z0-9]+(\.[a-z0-9]+)*$`.
   - ONLY lowercase ASCII letters `a-z`, digits `0-9`, and dot separators `.` are permitted.
   - NEVER use underscores (`_`), hyphens (`-`), spaces, or uppercase characters in permission codes (e.g. use `purchases.expenses.read`, NEVER `purchases.expense_types.read`).
   - Every addition or modification to `MenuCatalogSeedData.cs` MUST be verified to prevent boot/startup crashes (`permission.code.format` -> `InvalidOperationException` -> Cloudflare 502).
9. **Prioritize Dedicated Views Over Modals (UI/UX Ergonomics)**:
   - AVOID creating modal popups (`Popup`) for primary business forms or operational workflows (creation, editing, or multi-step processes with 3+ fields, sub-item grids, or calculations).
   - ALWAYS build dedicated full pages (`PageHeader`, `SectionCard`, 'Back' action, and dedicated RESTful routes like `/modulo/entidad/nueva` or `/modulo/entidad/:id`) following the skill `ui-vistas-sobre-modales`.
   - Reserve modals (`Popup`) STRICTLY for low-content micro-interactions: 1-click destructive action confirmations, brief alerts, or 1-2 field quick prompts (e.g. rejection reasons or quick tags).

