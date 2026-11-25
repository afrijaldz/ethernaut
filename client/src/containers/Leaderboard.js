import LeaderList from "../components/leaderboard/LeaderList";
import { useEffect, useState, useCallback } from "react";
import ReactPaginate from "react-paginate";
import Search from "../components/leaderboard/Search";
import { getNetworkNamefromId } from "../utils/ethutil";
import { NETWORKS } from "client/src/constants";
import { loadTranslations } from "../utils/translations";
import axios from "axios";
import { ALIAS_PATH, getLeaderboardPath } from "client/src/constants";

const playersPerPage = 20;

let aliases = {};

const fetchAliases = async () => {
  try {
    const response = await axios.get(ALIAS_PATH);
    aliases = response.data;
  } catch (err) {
    console.log("Failed to fetch aliases");
  }
};

fetchAliases();

function Leaderboard() {
  const [offset, setOffset] = useState(0);
  const [playersWithRank, setPlayersWithRank] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentNetworkName, setCurrentNetworkName] = useState("");

  const isKeywordMatching = (player) => {
    const keyword = searchKeyword.toLowerCase();
    return (
      player.player.toLowerCase().includes(keyword) ||
      (player.alias && player.alias.toLowerCase().includes(keyword))
    );
  };

  const strings = loadTranslations(localStorage.getItem("lang"));
  const searchResult = playersWithRank.filter(isKeywordMatching);
  const pageCount = Math.ceil(searchResult.length / playersPerPage);
  const endOffset = offset + playersPerPage;
  const currentItems = searchResult.slice(offset, endOffset);

  const handleNetworkChange = useCallback(async (networkId) => {
    if (!networkId) {
      return;
    }
    const networkName = getNetworkNamefromId(Number(networkId));
    setCurrentNetworkName(networkName);
  }, []);

  const initateCurrentlySelectedChain = useCallback(async () => {
    const networkId = await window.ethereum.request({ method: "eth_chainId" });
    handleNetworkChange(networkId);
  }, [handleNetworkChange]);

  // During the initial render
  useEffect(() => {
    if (!window.ethereum) return;
    initateCurrentlySelectedChain();
  }, [initateCurrentlySelectedChain]);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on("networkChanged", handleNetworkChange);
    return () => {
      window.ethereum.removeListener("networkChanged", handleNetworkChange);
    };
  }, [handleNetworkChange]);

  const fetchAndUpdate = useCallback(async () => {
    setPlayersWithRank([]);
    setOffset(0);
    try {
      if (!currentNetworkName) {
        return;
      }
      const leaderboardNetworkName =
        getLeaderboardNetworkNameFromNetworkName(currentNetworkName);
      const response = await axios.get(
        getLeaderboardPath(leaderboardNetworkName)
      );
      const result = response.data;
      const playersWithRank = result
        .map(assignRank)
        .filter(isScoreNonZero)
        .map(assignAlias);
      setPlayersWithRank(playersWithRank);
    } catch (err) {
      console.log("Failed to fetch leaderboard");
    }
  }, [currentNetworkName]);

  // When network changes
  useEffect(() => {
    fetchAndUpdate();
  }, [fetchAndUpdate]);

  const getLeaderboardNetworkNameFromNetworkName = (networkName) => {
    const networks = Object.entries(NETWORKS);
    const network = networks.find(
      (network) => network[1]?.name === networkName
    );
    const leaderboardNetworkName = network[0].toLowerCase().split("_")[0];
    return capitaliseFirstLetter(leaderboardNetworkName);
  };

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

const assignRank = (item, index) => {
  return {
    ...item,
    rank: index + 1,
  };
};

const assignAlias = (player) => {
  const alias = aliases[player.player.toLowerCase()];
  if (!alias) return player;
  return {
    ...player,
    alias: alias,
  };
};

const isScoreNonZero = (player) => {
  return player.score !== 0;
};

const capitaliseFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export default Leaderboard;
