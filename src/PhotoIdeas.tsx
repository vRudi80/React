import { useEffect, useState } from 'react';

type PhotoIdea = {
  id: number;
  title: string;
};

const API_BASE = 'http://localhost:4000/api';

export default function PhotoIdeas() {
  const [ideas, setIdeas] = useState<PhotoIdea[]>([]);
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Betöltés a backendről
  useEffect(() => {
    const loadIdeas = async () => {
      try {
        const res = await fetch(`${API_BASE}/ideas`);
        if (!res.ok) {
          throw new Error('Hiba a lekérdezés során');
        }
        const data = await res.json();
        setIdeas(data);
      } catch (err) {
        console.error(err);
        setError('Nem sikerült betölteni az ötleteket 😕');
      } finally {
        setLoading(false);
      }
    };

    loadIdeas();
  }, []);

  const addIdea = async () => {
    if (!newIdea.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newIdea }),
      });

      if (!res.ok) {
        throw new Error('Nem sikerült menteni');
      }

      const created = await res.json();
      setIdeas((prev) => [created, ...prev]); // új elöl
      setNewIdea('');
    } catch (err) {
      console.error(err);
      setError('Nem sikerült menteni az ötletet 😕');
    }
  };

  const removeIdea = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/ideas/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok && res.status !== 204) {
        throw new Error('Nem sikerült törölni');
      }

      setIdeas((prev) => prev.filter((idea) => idea.id !== id));
    } catch (err) {
      console.error(err);
      setError('Nem sikerült törölni az ötletet 😕');
    }
  };

  return (
    <section
      style={{
        maxWidth: '480px',
        margin: '40px auto',
        textAlign: 'left',
        background: '#111',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <h2>📷 Photo-ötletek (DB)</h2>

      <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <input
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          placeholder="Új fotóötlet..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #444',
            background: '#000',
            color: '#fff',
          }}
        />
        <button
          onClick={addIdea}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Hozzáad
        </button>
      </div>

      {loading && <p>Betöltés...</p>}
      {error && (
        <p style={{ color: '#f55', marginBottom: '8px' }}>{error}</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {ideas.map((idea) => (
          <li
            key={idea.id}
            style={{
              padding: '8px 10px',
              marginBottom: '6px',
              borderRadius: '8px',
              background: '#1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{idea.title}</span>
            <button
              onClick={() => removeIdea(idea.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#f55',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              törlés
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
