const Search = ({ searchKeyword, onKeywordChange }) => {
  return (
    <div className="leaderboard-search">
      <label htmlFor="leaderboard-search">Search player address / alias</label>
      <input
        id="leaderboard-search"
        type="text"
        className="ui-input"
        value={searchKeyword}
        onChange={(event) => onKeywordChange(event.target.value)}
      />
    </div>
  );
};

export default Search;
