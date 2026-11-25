import React from "react";
import { loadTranslations } from "../../utils/translations";
import { connect } from "react-redux";
import { contractsDeploymentStatus, raiseIssue, deployStatus } from "../../utils/contractutil";

const FooterContent = ({ networkId }) => {
    let language = localStorage.getItem("lang");
    const strings = loadTranslations(language);
    const deploymentStatus = contractsDeploymentStatus(networkId);

    if (deploymentStatus === deployStatus.ALL_DEPLOYED) {
        return (
            <button type="button" className="ui-button" onClick={raiseIssue}>
                {strings.submitGameFooter}
            </button>
        );
    }

    if (deploymentStatus === deployStatus.CORE_DEPLOYED) {
        return <span dangerouslySetInnerHTML={{ __html: strings.submitLevelFooter }}></span>;
    }

    return (
        <>
            <span dangerouslySetInnerHTML={{ __html: strings.footer }}></span>
            {" · "}
            <a href="https://github.com/afrijaldz/ethernaut">Source code of this deployment</a>
        </>
    );
};

export const Footer = (props) => (
    <footer className="site-footer">
        <div className="site-footer__inner">
            <FooterContent networkId={props.network.networkId} />
        </div>
    </footer>
);

const mapStateToProps = (state) => {
    return {
        network: state.network,
    };
}


export default connect(mapStateToProps)(Footer);
