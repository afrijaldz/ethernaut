import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as actions from "../../actions";
import * as constants from "../../constants";
import { isSupportedNetwork } from "../../middlewares/setNetwork";
import { loadTranslations } from "../../utils/translations";
import { randBadIcon } from "../../utils/^^";
import {
  RESULT,
  getChainId,
  getSafeIcon,
  getWallets,
  isWalletConnect,
  requestAccounts,
  selectWallet,
  subscribeToWallets,
  switchNetwork,
} from "../../utils/wallet";

function ConnectionDialog() {
  const open = useSelector((state) => state.network.connectionDialogOpen);
  return open ? <OpenDialog /> : null;
}

function OpenDialog() {
  const dispatch = useDispatch();
  const [wallets, setWallets] = useState(getWallets);
  const [error, setError] = useState(null);
  const [icon] = useState(randBadIcon);
  // Only the last choice counts: an older wallet prompt can be answered later.
  const lastAttempt = useRef(0);
  const connecting = useRef(null);
  const strings = loadTranslations(localStorage.getItem("lang"));

  useEffect(() => {
    const updateWallets = () => setWallets(getWallets());
    updateWallets();
    return subscribeToWallets(updateWallets);
  }, []);

  const continueInReadOnly = useCallback(() => {
    dispatch(actions.setGameReadOnly(true));
    dispatch(actions.setConnectionDialogOpen(false));
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Escape closes the WalletConnect modal, not this dialog.
      if (isWalletConnect(connecting.current)) return;
      if (event.key === "Escape") continueInReadOnly();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [continueInReadOnly]);

  useEffect(
    () => () => {
      lastAttempt.current++;
    },
    []
  );

  const connect = async (wallet) => {
    const attempt = ++lastAttempt.current;
    setError(null);

    connecting.current = wallet;
    const connection = await requestAccounts(wallet);
    if (attempt !== lastAttempt.current) return;
    connecting.current = null;
    if (connection === RESULT.REJECTED) return;
    if (connection === RESULT.WRONG_NETWORK) {
      setError(strings.baseSepoliaNotSupported);
      return;
    }
    if (connection === RESULT.FAILED) {
      setError(strings.walletConnectionFailed);
      return;
    }
    selectWallet(wallet);

    let chainId;
    try {
      chainId = await getChainId();
    } catch (chainError) {
      console.error(chainError);
      setError(strings.walletConnectionFailed);
      return;
    }
    if (attempt !== lastAttempt.current) return;
    if (!isSupportedNetwork(chainId)) {
      const switched = await switchNetwork(constants.NETWORKS_INGAME.BASE_SEPOLIA);
      if (attempt !== lastAttempt.current) return;
      if (switched === RESULT.REJECTED) return;
      if (switched === RESULT.FAILED) {
        setError(strings.baseSepoliaNotSupported);
        return;
      }
    }
    window.location.reload();
  };

  return (
    <div className="ui-dialog-backdrop">
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-connection-title"
      >
        <button
          type="button"
          className="ui-button ui-button--secondary ui-dialog__close"
          aria-label={strings.close}
          autoFocus
          onClick={continueInReadOnly}
        >
          ×
        </button>
        <p className="ui-dialog__icon">{icon}</p>
        <h2 id="account-connection-title" className="ui-dialog__title">
          {strings.accountNotConnectedTitle}
        </h2>
        <p>{strings.accountNotConnectedMessage}</p>
        {error && (
          <p className="ui-alert ui-alert--danger" role="alert">
            {error}
          </p>
        )}
        {wallets.length === 0 && <p>{strings.noWalletFoundMessage}</p>}
        {wallets.length > 0 && (
          <ul className="wallet-list">
            {wallets.map((wallet) => {
              const walletIcon = getSafeIcon(wallet.info);
              return (
                <li key={wallet.info.uuid}>
                  <button
                    type="button"
                    className="ui-button ui-button--secondary wallet-list__button"
                    onClick={() => connect(wallet)}
                  >
                    {walletIcon && (
                      <img className="wallet-list__icon" alt="" src={walletIcon} />
                    )}
                    <span>{wallet.info.name || strings.browserWallet}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="ui-dialog__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={continueInReadOnly}
          >
            {strings.continueInReadOnly}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectionDialog;
