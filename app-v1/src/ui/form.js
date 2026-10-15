const FIELDS = [
  { key: 'price', label: 'Property price (€)' },
  { key: 'down', label: 'Down payment (%)' },
  { key: 'rate', label: 'Annual interest rate (%)' },
  { key: 'years', label: 'Loan term (years)' },
];

// Builds the inputs once; they are never rebuilt, so focus and caret survive renders.
// onChange receives the full raw object on every `input` event.
export function mountForm(root, defaults, onChange) {
  const parts = {};
  for (const { key, label } of FIELDS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.field = key;

    const lab = document.createElement('label');
    lab.htmlFor = key;
    lab.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.id = key;
    input.name = key;
    input.value = defaults[key];

    const error = document.createElement('div');
    error.className = 'error';
    error.setAttribute('role', 'alert');

    const warning = document.createElement('div');
    warning.className = 'warning';
    warning.hidden = true;

    wrap.append(lab, input, error, warning);
    root.append(wrap);
    parts[key] = { wrap, input, error, warning };
  }

  const getRaw = () => Object.fromEntries(FIELDS.map(({ key }) => [key, parts[key].input.value]));
  root.addEventListener('input', () => onChange(getRaw()));

  return {
    getRaw,
    setErrors(errors) {
      for (const { key } of FIELDS) {
        const msg = errors[key] ?? '';
        parts[key].error.textContent = msg;
        parts[key].wrap.classList.toggle('invalid', msg !== '');
      }
    },
    setWarnings(warnings) {
      for (const { key } of FIELDS) {
        const msg = warnings[key] ?? '';
        parts[key].warning.textContent = msg;
        parts[key].warning.hidden = msg === '';
      }
    },
  };
}
