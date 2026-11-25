import Headers from "./Headers";
import LeaderTile from "./LeaderTile";
import AliasModal from "./AliasModal";
import { useToast } from "../utils/Toast";
import { getProvider } from "../../utils/wallet";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

function LeaderList(props) {
  const { players } = props;
  const [show, setShow] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const web3 = useSelector((state) => state.network.web3);
  const { toast, Toast } = useToast();

  const showEditModal = () => {
    setShow(true);
  };

  const handleClose = () => {
    setShow(false);
  };

  useEffect(() => {
    if (!web3) return;
    getProvider()
      .request({ method: "eth_accounts" })
      .then((accounts) => setCurrentUser(accounts[0]));
  }, [web3]);

  return (
    <>
      {Toast}
      {show && <AliasModal currentUser={currentUser} onClose={handleClose} />}
      {players.length === 0 ? (
        <p className="ui-card leaderboard-empty">There are no players to show.</p>
      ) : (
        <table className="ui-table leaderboard-table" role="table">
          <Headers />
          <tbody>
            {players.map((leader) => (
              <LeaderTile
                currentUser={currentUser}
                onAliasEdit={showEditModal}
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
