# EcuNexo Frontend Guidelines & UI/UX Standards

When creating or modifying UI components, views, layouts, or styles in this repository:

1. **Leverage glubox for atomic components**:
   - Use `glubox` for `Button`, `TextBox`, `Select`, `Popup`, `Toast`, `DataGrid`, `RangeDateBox`, `ColorPicker`, `FileBox`, and `Sidebar`.
2. **Apply Google Material Design 3 (M3) + Modern Enterprise SaaS patterns**:
   - Organize pages using standard layouts: `PageHeader` (title, badge, lead, action buttons) -> KPI / `StatCard` strip -> `SectionCard` containers -> `DataGrid` with toolbars.
   - Avoid plain or flat screens with isolated tables or links.
   - Use semantic design tokens: `var(--glb-surface)`, `var(--shell-border)`, `var(--shell-primary)`, `var(--glb-text)`, `var(--glb-muted)`.
   - Implement elegant empty states and loading skeletons instead of bare empty tables.
   - Support dark mode (`html.sf-dark-mode`) seamlessly with subtle translucent borders (`rgba(255,255,255,0.08)`) and soft contrast.
3. **Strictly avoid duplicate action buttons in PageHeader & EcuPageActions**:
   - In desktop view, `<EcuPageActions items={actionItems} />` renders its items directly as buttons in the toolbar (`.ecu-page-actions__desktop`).
   - NEVER add an action to `actionItems` if that action is already rendered as a standalone `<Button>` in `PageHeader.actions` (e.g. creating items, canceling batches, downloading reports). This prevents duplicate buttons appearing side by side.
4. **Automated Semantic Versioning (Zero Manual Request Rule)**:
   - NEVER wait for the user to ask to update the version.
   - For every task, analyze the changes and proactively apply Semantic Versioning (`MAJOR.MINOR.PATCH`):
     - **PATCH**: Bug fixes, styling adjustments, removing duplicate buttons, minor validations on existing views, copy/text tweaks.
     - **MINOR**: New modules, new pages/views (e.g. Directorio de Clientes), new endpoints, new workflows, major validations.
     - **MAJOR**: Breaking API changes, destructive database schema migrations, architectural shifts.
   - Proactively increment `"version"` in `ecunexo_admin/package.json` and sync `AboutAppModal.tsx` changelog before committing.
   - Reference the new version in the git commit message (e.g. `feat(clientes): ... [v0.8.0]`).
