import React, { useId, useMemo } from 'react';

const SuggestInput = ({ suggestions = [], list, ...inputProps }) => {
  const generatedId = useId();
  const datalistId = list || `suggest-${generatedId}`;
  const options = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const raw of suggestions) {
      if (raw == null) continue;
      const value = String(raw).trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [suggestions]);
  return (
    <>
      <input list={datalistId} {...inputProps} />
      {options.length > 0 ? (
        <datalist id={datalistId}>
          {options.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      ) : null}
    </>
  );
};

export default SuggestInput;
