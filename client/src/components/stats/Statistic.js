import React from "react";
import { formatNumberWithComma } from "../../utils/stringutil";

export default function Statistic({
    heading,
    value = 0
}) {
  return <section className="ui-card">
    <h2 className="stats-statistic__title">
        {heading}
    </h2>
    <p className="stats-statistic__value">
        {formatNumberWithComma(value)}
    </p>
  </section>;
}
