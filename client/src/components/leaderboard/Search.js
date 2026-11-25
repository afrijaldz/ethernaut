import { loadTranslations } from "../../utils/translations";

const Search = ({ searchKeyword, onKeywordChange }) => {
  const strings = loadTranslations(localStorage.getItem("lang"));

  return (
    <div className="leaderboard-search">
      <label htmlFor="leaderboard-search">{strings.leaderboardSearch}</label>
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
