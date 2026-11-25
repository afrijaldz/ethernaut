import Tooltip from "../utils/Tooltip";
import { loadTranslations } from "../../utils/translations";

function LeaderTile(props) {
  const { rank, leader, currentUser, toast } = props;
  const { player, score, completed } = leader;
  const strings = loadTranslations(localStorage.getItem("lang"));

  const handleClick = () => {
    navigator.clipboard.writeText(player);
    toast("Address copied");
  };

  return (
    <tr className="leaderboard-player" role="row">
      <td role="cell">
        <span className="leaderboard-player__label">Rank</span>
        {rank}
      </td>
      <td role="cell">
        <span className="leaderboard-player__label">Player</span>
        <div className="leaderboard-player__identity">
          <Tooltip content={player}>
            <button
              type="button"
              className="leaderboard-address"
              onClick={handleClick}
            >
              <span className="leaderboard-address__text">{player}</span>
            </button>
          </Tooltip>
          {currentUser?.toLowerCase() === player.toLowerCase() && (
            <span className="ui-badge">{strings.you}</span>
          )}
        </div>
      </td>
      <td role="cell">
        <span className="leaderboard-player__label">Levels solved</span>
        {completed}
      </td>
      <td role="cell">
        <span className="leaderboard-player__label">Score</span>
        {score.toFixed(2)}
      </td>
    </tr>
  );
}

export default LeaderTile;
