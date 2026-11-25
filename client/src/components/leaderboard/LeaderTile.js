import Tooltip from "../utils/Tooltip";

function LeaderTile(props) {
  const { rank, leader, onAliasEdit, currentUser, toast } = props;
  const { player, score, totalNumberOfLevelsCompleted, alias } = leader;

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
          {alias ? (
            <span>{alias}</span>
          ) : (
            <Tooltip content={player}>
              <button
                type="button"
                className="leaderboard-address"
                onClick={handleClick}
              >
                <span className="leaderboard-address__text">{player}</span>
              </button>
            </Tooltip>
          )}
          {currentUser?.toLowerCase() === player.toLowerCase() && (
            <button
              type="button"
              className="ui-button ui-button--secondary"
              aria-label="Edit alias"
              onClick={onAliasEdit}
            >
              <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
            </button>
          )}
        </div>
      </td>
      <td role="cell">
        <span className="leaderboard-player__label">Levels solved</span>
        {totalNumberOfLevelsCompleted}
      </td>
      <td role="cell">
        <span className="leaderboard-player__label">Score</span>
        {score.toFixed(2)}
      </td>
    </tr>
  );
}

export default LeaderTile;
