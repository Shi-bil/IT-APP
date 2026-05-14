import React from 'react';

// Wraps occurrences of `query` inside `text` with a yellow highlight. Returns
// the text untouched when the query is empty or non-matching.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight = ({ text, query }) => {
  const str = text == null ? '' : String(text);
  const q = (query || '').trim();
  if (!q || !str) return <>{str}</>;
  const parts = str.split(new RegExp(`(${escapeRegex(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

export default Highlight;
