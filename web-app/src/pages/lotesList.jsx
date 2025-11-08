import React, { useEffect, useState } from "react";
import { getLotes } from "../services/lotes.service";

const LotesList = () => {
  const [lotes, setLotes] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getLotes();
        setLotes(data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  return (
    <div>
      <h2>Lotes</h2>
      <ul>
        {lotes.map((l) => <li key={l.id}>{l.nombre || l.id}</li>)}
      </ul>
    </div>
  );
};

export default LotesList;
