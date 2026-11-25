// The roles keep the table semantics when the CSS shows the rows as cards.
function Headers() {
  return (
    <thead>
      <tr role="row">
        <th role="columnheader" scope="col">Rank</th>
        <th role="columnheader" scope="col">Player</th>
        <th role="columnheader" scope="col">Levels solved</th>
        <th role="columnheader" scope="col">Score</th>
      </tr>
    </thead>
  );
}

export default Headers;
