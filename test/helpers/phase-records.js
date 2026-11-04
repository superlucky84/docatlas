export const PHASE_PLAN = [
  '# Checkout — Implementation', '',
  '## Guest session', '', 'Refs: RQ-1, DC-1, M-1', '',
  '### Work', '',
  'Files:', '- `src/checkout/session.js` (added)', '- `docs/checkout/IMPLEMENT.md` (modified)', '',
  '### Work', '',
  'Files:', '- `src/checkout/session.js` (modified)',
  '- `src/checkout/old.js` -> `src/checkout/cart.js` (renamed)',
  '- `src/checkout/removed.js` (deleted)', '- `generated/assets/` (added)', '',
  '## Verification', '', 'Refs: none', '', 'Files: none', '',
  '## Example only', '',
  '````markdown', '```', 'Refs: RQ-99', 'Files:', '- `fake.js` (added)', '```', '````', '',
  '    Files:', '    - `indented.js` (added)', ''
].join('\n');

export const PHASE_FILES = {
  'docs/checkout/DESIGN.md': '# Checkout — Design\n\nGuest checkout.\n\n' +
    Array.from({ length: 40 }, (_, index) => 'Paragraph ' + index + '. Preserve the reading position.').join('\n\n'),
  'docs/checkout/IMPLEMENT.md': PHASE_PLAN,
  'docs/unrelated/DESIGN.md': '# Unrelated — Design\n\nA separate feature.'
};
