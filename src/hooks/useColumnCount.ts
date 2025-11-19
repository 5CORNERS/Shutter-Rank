import { useState, useEffect } from 'react';

export const useColumnCount = () => {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1024) { // lg
        setColumns(4);
      } else if (width >= 768) { // md
        setColumns(3);
      } else if (width >= 640) { // sm
        setColumns(2);
      } else {
        setColumns(1);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return columns;
};