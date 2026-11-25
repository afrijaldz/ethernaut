import React from "react";

export default function StatisticPanel({ children, title, show }) {
  if(!show) return <></>;
  return (
    <section className="ui-card">
      <h2 className="stats-panel__title">{title}</h2>
      {children}
    </section>
  );
}
