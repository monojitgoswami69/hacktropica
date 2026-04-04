import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useFilters() {
  const [data, setData] = useState({ semesters: [], streams: [], subjects: [], curriculum: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchFilters = async () => {
      try {
        const response = await api.filters.getFilters();
        if (mounted && response) {
          const rawData = response.data || response;
          // Sort semesters naturally (e.g., 'sem 1', 'sem 2', 'sem 10')
          if (rawData.semesters) {
            rawData.semesters.sort((a, b) => {
              const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
              const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
              return numA - numB;
            });
          }
          setData(rawData);
        }
      } catch (error) {
        console.error("Failed to load filters", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchFilters();
    return () => { mounted = false; };
  }, []);

  return { data, loading };
}
