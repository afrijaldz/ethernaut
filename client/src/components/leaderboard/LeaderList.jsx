import Headers from "./Headers";
import LeaderTile from "./LeaderTile";
import { useToast } from "../utils/Toast";
import { loadTranslations } from "../../utils/translations";
import { useSelector } from "react-redux";

function LeaderList(props) {
  const { players } = props;
  const currentUser = useSelector((state) => state.player.address);
  const { toast, Toast } = useToast();
  const strings = loadTranslations(localStorage.getItem("lang"));

  return (
    <>
      {Toast}
      {players.length === 0 ? (
        <p className="ui-card leaderboard-message">{strings.leaderboardEmpty}</p>
      ) : (
        <table className="ui-table leaderboard-table" role="table">
          <Headers />
          <tbody>
            {players.map((leader) => (
              <LeaderTile
                currentUser={currentUser}
                key={leader.player}
                rank={leader.rank}
                leader={leader}
                toast={toast}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default LeaderList;
