import LeaderList from "../components/leaderboard/LeaderList";
import { useEffect, useState } from "react";
import reactPaginate from "react-paginate";
import Search from "../components/leaderboard/Search";
import { NETWORKS_INGAME } from "../constants";
import { loadTranslations } from "../utils/translations";
import { createRpcProvider, fetchPlayers, rankPlayers } from "../utils/leaderboard";
import gamedata from "../gamedata/gamedata.json";
import deployData from "../gamedata/deploy.base-sepolia.json";

// react-paginate is CommonJS, so its default import is the whole `exports` object.
const ReactPaginate = reactPaginate.default;

const playersPerPage = 20;

const STATUS = { LOADING: "loading", FAILED: "failed", LOADED: "loaded" };

const levels = gamedata.levels.map((level) => ({
  address: deployData[level.deployId],
  difficulty: Number(level.difficulty),
}));

const provider = createRpcProvider(NETWORKS_INGAME.BASE_SEPOLIA.rpcUrl);

function Leaderboard() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [attempt, setAttempt] = useState(0);
  const [playersWithRank, setPlayersWithRank] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");

  const isKeywordMatching = (player) =>
    player.player.toLowerCase().includes(searchKeyword.toLowerCase());

  const strings = loadTranslations(localStorage.getItem("lang"));
  const searchResult = playersWithRank.filter(isKeywordMatching);
  const pageCount = Math.ceil(searchResult.length / playersPerPage);
  const endOffset = offset + playersPerPage;
  const currentItems = searchResult.slice(offset, endOffset);

  useEffect(() => {
    let isCancelled = false;
    setStatus(STATUS.LOADING);
    fetchPlayers(provider, deployData.proxyStats, levels)
      .then((players) => {
        if (isCancelled) return;
        setPlayersWithRank(rankPlayers(players, levels));
        setStatus(STATUS.LOADED);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Failed to read the leaderboard", err);
        setStatus(STATUS.FAILED);
      });
    return () => {
      isCancelled = true;
    };
  }, [attempt]);

  const handlePageClick = (event) => {
    const newOffset = (event.selected * playersPerPage) % searchResult.length;
    setOffset(newOffset);
  };

  const handleKeywordChange = (keyword) => {
    setSearchKeyword(keyword);
    setOffset(0);
  };

  return (
    <main className="leaderboard-page">
      <h1>{strings.leaderboard}</h1>
      {status === STATUS.LOADING && (
        <p className="ui-card leaderboard-message" role="status">
          {strings.leaderboardLoading}
        </p>
      )}
      {status === STATUS.FAILED && (
        <div className="ui-alert ui-alert--danger leaderboard-error" role="alert">
          <p>{strings.leaderboardError}</p>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => setAttempt(attempt + 1)}
          >
            {strings.retry}
          </button>
        </div>
      )}
      {status === STATUS.LOADED && (
        <>
          <Search
            searchKeyword={searchKeyword}
            onKeywordChange={handleKeywordChange}
          />
          <LeaderList players={currentItems} />
          <ReactPaginate
            onPageChange={handlePageClick}
            pageCount={pageCount}
            forcePage={offset / playersPerPage}
            {...reactPaginateProps}
          />
        </>
      )}
    </main>
  );
}

const reactPaginateProps = {
  pageRangeDisplayed: 5,
  renderOnZeroPageCount: null,
  breakLabel: "...",
  nextLabel: "→",
  previousLabel: "←",
  containerClassName: "leaderboard-pagination",
  pageLinkClassName: "ui-button ui-button--secondary",
  activeLinkClassName: "leaderboard-pagination__link--active",
  nextLinkClassName: "ui-button ui-button--secondary",
  previousLinkClassName: "ui-button ui-button--secondary",
  breakLinkClassName: "ui-button ui-button--secondary",
  disabledLinkClassName: "leaderboard-pagination__link--disabled",
};

export default Leaderboard;
