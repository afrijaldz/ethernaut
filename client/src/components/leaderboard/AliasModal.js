import { useRef, useEffect } from "react";
import { loadTranslations } from "../../utils/translations";
import HubspotForm from "./Hubspot";

export default function AliasModal(props) {
  const { onClose, currentUser } = props;
  const strings = loadTranslations(localStorage.getItem("lang"));
  const modalEl = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (!modalEl.current.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="ui-dialog-backdrop">
      <div
        ref={modalEl}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alias-title"
      >
        <button
          type="button"
          className="ui-button ui-button--secondary ui-dialog__close"
          aria-label={strings.close}
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="alias-title" className="ui-dialog__title">
          Leaderboard alias submission
        </h2>
        <HubspotForm
          portalId="7795250"
          formId="5c2762b1-ad80-4a47-9ef5-91f98d9e9419"
          region="na1"
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
