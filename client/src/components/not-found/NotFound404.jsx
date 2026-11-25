import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { loadTranslations } from "../../utils/translations";
import { Link } from "react-router";
import * as constants from "../../constants";
import { randBadIcon } from "../../utils/^^";

class NotFound404 extends React.Component {
  render() {
    let language = localStorage.getItem("lang");
    let strings = loadTranslations(language);

    return (
      <div>
        <main className="page-not-found-container">
          <p className="page-not-found-icon" aria-hidden="true">
            {randBadIcon()}
          </p>
          <h1>{strings.PageNotFoundTitle}</h1>
          <p>{strings.PageNotFoundText}</p>
          <Link className="ui-button" to={constants.PATH_ROOT}>
            {strings.home}
          </Link>
        </main>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    language: state.lang,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(NotFound404);
